#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { generate, render } from './generator.mjs';

function help() {
  console.log(
    `create-sovereign-app\n\nUsage: create-sovereign-app [options]\n\nOptions:\n  --name NAME              lowercase project name\n  --namespace NAME         protocol namespace (defaults to name)\n  --package-scope @scope   package scope\n  --platforms LIST         electron,android,ios,web\n  --modules LIST           qr,mdns,webPresence,nextExample,exampleCodec,electron,reactNative\n  --dir PATH               output directory (basename must equal name)\n  --dry-run                print files without writing\n  --print-config           print the resolved manifest\n  --yes                    skip interactive confirmation\n  --help                   show this help`,
  );
}

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') result.help = true;
    else if (token === '--dry-run') result.dryRun = true;
    else if (token === '--print-config') result.printConfig = true;
    else if (token === '--yes') result.yes = true;
    else if (token.startsWith('--')) result[token.slice(2)] = argv[++i];
    else throw new Error(`unexpected argument: ${token}`);
  }
  return result;
}

async function interactive(config) {
  const rl = readline.createInterface({ input, output });
  try {
    config.name ||= await rl.question('Project name: ');
    config.namespace ||= (await rl.question(`Namespace [${config.name}]: `)) || config.name;
    config.platforms ||=
      (await rl.question('Platforms [electron,android]: ')) || 'electron,android';
    config.modules ||=
      (await rl.question('Modules [electron,reactNative,qr]: ')) || 'electron,reactNative,qr';
    config.output ||= config.name;
  } finally {
    rl.close();
  }
  return config;
}

try {
  const options = args(process.argv.slice(2));
  if (options.help) {
    help();
    process.exit(0);
  }
  const config = options.name ? options : await interactive(options);
  const result = render(config);
  if (options.printConfig) console.log(JSON.stringify(result.manifest, null, 2));
  if (options.dryRun) {
    console.log(
      JSON.stringify(
        { root: result.config.output, files: [...result.files.keys()], manifest: result.manifest },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  if (!options.yes && !options.name) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      `Generate ${result.config.name} with ${result.config.modules.length} modules? [y/N] `,
    );
    rl.close();
    if (answer.toLowerCase() !== 'y') process.exit(1);
  }
  const generated = await generate(config);
  console.log(`Generated ${generated.root}`);
} catch (error) {
  console.error(`create-sovereign-app: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
