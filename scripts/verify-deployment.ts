import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { benchmarkRoute } from '../src/routing/benchmark.js';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph.js';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph.js';
import { parseFloorDataset, parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed.js';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork.js';
import { parsePlaceTranslations } from '../src/schema/placeTranslations.js';

const distRoot = 'dist';
const rawExtensions = new Set(['.shp', '.shx', '.dbf', '.prj', '.cpg']);
const MAX_PROCESSED_BYTES = 10_000_000;
const MAX_JAVASCRIPT_CHUNK_BYTES = 1_000_000;
const SITE_ORIGIN = 'https://shinjuku.leotctam.com';
const EXPECTED_PROCESSED_ASSETS = [
  'jr-shinjuku-ticket-gates-b1-official-network.json',
  'jr-shinjuku-ticket-gates-b1.json',
  'shinjuku-b1-named-places.json',
  'shinjuku-full-map.json',
  'shinjuku-reviewed-custom-network.json',
  'shinjuku-place-translations.json',
] as const;

function filesUnder(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name)).sort();
}

function requireHtml(html: string, file: string, required: string[]): void {
  const missing = required.filter((value) => !html.includes(value));
  if (missing.length > 0) throw new Error(`SEO markup is missing from ${file}:\n${missing.join('\n')}`);
}

export function verifyDeployment(): void {
  const files = filesUnder(distRoot);
  const rawFiles = files.filter((file) => rawExtensions.has(path.extname(file).toLowerCase()));
  if (rawFiles.length > 0) throw new Error(`Raw GIS files must not be deployed:\n${rawFiles.join('\n')}`);

  const html = readFileSync(path.join(distRoot, 'index.html'), 'utf8');
  if (/\b(?:src|href)="\/(?!\/)/.test(html)) throw new Error('Production HTML contains a root-absolute asset URL and will not be repository-subpath safe.');
  if (!html.includes('./assets/')) throw new Error('Production HTML does not contain repository-relative bundled assets.');
  const japaneseHtml = readFileSync(path.join(distRoot, 'ja', 'index.html'), 'utf8');
  requireHtml(html, 'index.html', [
    '<html lang="en">',
    `<link rel="canonical" href="${SITE_ORIGIN}/" />`,
    `<link rel="alternate" hreflang="ja" href="${SITE_ORIGIN}/ja/" />`,
    '<meta property="og:type" content="website" />',
    '<meta name="twitter:card" content="summary" />',
    '"@type": "WebApplication"',
    '<h1>Shinjuku Station Navigator</h1>',
  ]);
  requireHtml(japaneseHtml, 'ja/index.html', [
    '<html lang="ja">',
    `<link rel="canonical" href="${SITE_ORIGIN}/ja/" />`,
    `<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/" />`,
    '<meta property="og:locale" content="ja_JP" />',
    '<h1>新宿駅ナビゲーター</h1>',
    '../assets/',
  ]);
  if (japaneseHtml.includes('/ja/ja/')) throw new Error('Japanese SEO page contains a duplicated locale path.');

  const robots = readFileSync(path.join(distRoot, 'robots.txt'), 'utf8');
  if (!robots.includes('User-agent: *') || !robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) throw new Error('robots.txt does not allow crawling and advertise the sitemap.');
  const sitemap = readFileSync(path.join(distRoot, 'sitemap.xml'), 'utf8');
  for (const url of [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/ja/`]) {
    if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`sitemap.xml is missing ${url}.`);
  }

  const dataFiles = files.filter((file) => file.includes(`${path.sep}data${path.sep}processed${path.sep}`));
  const dataFileNames = new Set(dataFiles.map((file) => path.basename(file)));
  const missingAssets = EXPECTED_PROCESSED_ASSETS.filter((file) => !dataFileNames.has(file));
  const extraAssets = [...dataFileNames].filter((file) => !EXPECTED_PROCESSED_ASSETS.includes(file as typeof EXPECTED_PROCESSED_ASSETS[number]));
  if (missingAssets.length > 0 || extraAssets.length > 0) throw new Error(`Processed browser assets do not match the release contract. Missing: ${missingAssets.join(', ') || 'none'}. Extra: ${extraAssets.join(', ') || 'none'}.`);
  const network = parseOfficialNetwork(JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as unknown);
  const reviewedNetwork = parseReviewedCustomNetwork(JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8')) as unknown, network);
  const places = parseNamedPlaces(JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as unknown, network, reviewedNetwork);
  const translations = parsePlaceTranslations(JSON.parse(readFileSync('public/data/processed/shinjuku-place-translations.json', 'utf8')) as unknown, places);
  const map = parseFloorDataset(JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as unknown);
  const mapLayerCount = new Set(map.features.map((feature) => feature.layer)).size;
  const mapFloorCount = new Set(map.features.flatMap((feature) => feature.floorId ? [feature.floorId] : [])).size;
  const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewedNetwork);
  const golden = JSON.parse(readFileSync('reports/human-golden-route.json', 'utf8')) as { start: { nodeId: string }; destination: { nodeId: string } };
  const benchmark = benchmarkRoute(graph, golden.start.nodeId, golden.destination.nodeId, 100);
  if (benchmark.averageMilliseconds >= 100) throw new Error(`Representative route averaged ${benchmark.averageMilliseconds.toFixed(3)} ms, exceeding the 100 ms budget.`);

  const distBytes = files.reduce((total, file) => total + statSync(file).size, 0);
  const processedBytes = dataFiles.reduce((total, file) => total + statSync(file).size, 0);
  const javascriptFiles = files.filter((file) => path.extname(file) === '.js');
  const largestJavascriptBytes = Math.max(...javascriptFiles.map((file) => statSync(file).size));
  if (processedBytes > MAX_PROCESSED_BYTES) throw new Error(`Processed browser data uses ${processedBytes} bytes, exceeding the ${MAX_PROCESSED_BYTES}-byte budget.`);
  if (largestJavascriptBytes > MAX_JAVASCRIPT_CHUNK_BYTES) throw new Error(`Largest JavaScript chunk uses ${largestJavascriptBytes} bytes, exceeding the ${MAX_JAVASCRIPT_CHUNK_BYTES}-byte budget.`);
  writeFileSync('reports/current-release-status.md', [
    '# Current Release Status',
    '',
    'Generated by `npm run release:verify` from the current production artifact and validated runtime data.',
    '',
    `- Official network: ${network.nodes.length.toLocaleString('en-US')} nodes and ${network.edges.length.toLocaleString('en-US')} edges.`,
    `- Named places: ${places.places.length.toLocaleString('en-US')} total and ${places.places.filter((place) => place.routable).length.toLocaleString('en-US')} routable.`,
    `- Place translations: ${translations.places.length.toLocaleString('en-US')} places and ${translations.areas.length.toLocaleString('en-US')} areas (${translations.statistics.statusCounts.pending.toLocaleString('en-US')} pending Japanese fallbacks).`,
    `- Visual map: ${mapLayerCount.toLocaleString('en-US')} layers and ${map.features.length.toLocaleString('en-US')} features across ${mapFloorCount.toLocaleString('en-US')} floors.`,
    `- Release artifact: ${files.length} files and ${(distBytes / 1_000_000).toFixed(2)} MB.`,
    `- Processed browser data: ${dataFiles.length} files and ${(processedBytes / 1_000_000).toFixed(2)} MB.`,
    `- Largest JavaScript chunk: ${(largestJavascriptBytes / 1_000).toFixed(1)} kB.`,
    `- Representative A* route: ${benchmark.averageMilliseconds.toFixed(3)} ms average over ${benchmark.iterations} runs.`,
    '- Raw GIS files in the release: none.',
    '',
  ].join('\n'));
  console.log(`Release artifact: ${files.length} files, ${(distBytes / 1_000_000).toFixed(2)} MB total.`);
  console.log(`Processed browser data: ${dataFiles.length} files, ${(processedBytes / 1_000_000).toFixed(2)} MB total.`);
  console.log(`Largest JavaScript chunk: ${(largestJavascriptBytes / 1_000).toFixed(1)} kB (budget ${(MAX_JAVASCRIPT_CHUNK_BYTES / 1_000).toFixed(0)} kB).`);
  console.log(`Representative A* route: ${benchmark.averageMilliseconds.toFixed(3)} ms average over ${benchmark.iterations} runs.`);
  console.log('Repository-relative paths verified; raw GIS files absent.');
}

verifyDeployment();
