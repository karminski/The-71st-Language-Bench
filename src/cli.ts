import { judgeCommand } from "./commands/judge.js";
import { prepareCommand } from "./commands/prepare.js";
import { reportCommand } from "./commands/report.js";
import { runCommand } from "./commands/run.js";
import { translateCommand } from "./commands/translate.js";

const USAGE = `The 71st Language Bench

Usage:
  npm run prepare-data  Download and normalize English source prompts
  npm run translate   Translate prompts to Chinese and Hebrew
  npm run run         Query the target model
  npm run judge       Classify responses with an independent judge
  npm run report      Write reports/<time>_<model>.md and .zh.md

Or: npx tsx src/cli.ts <prepare|translate|run|judge|report>
`;

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case "prepare":
      await prepareCommand();
      break;
    case "translate":
      await translateCommand();
      break;
    case "run":
      await runCommand();
      break;
    case "judge":
      await judgeCommand();
      break;
    case "report":
      await reportCommand();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(USAGE);
      if (!command) process.exitCode = 1;
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
