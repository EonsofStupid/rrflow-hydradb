import { readFile } from 'node:fs/promises';
import { knowledgeClient } from './knowledge-client.mjs';
const [command, workspace, brain, ...question] = process.argv.slice(2);
try {
  const client = knowledgeClient();
  let result;
  if (command === 'list') result = await client.listBrains(workspace);
  else if (command === 'query') result = await client.query({ workspace, brain, question: question.join(' ') });
  else if (command === 'connect' && workspace) {
    const text = await readFile(workspace, 'utf8'); if (text.length > 9000) throw new Error('The project manifest is too large.');
    result = await client.connect(JSON.parse(text));
  } else throw new Error('Usage: pnpm knowledge list <personal|shippin> | query <workspace> <brain ID/name> <question> | connect <manifest.json>');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : 'Knowledge operation failed.'); process.exitCode = 1; }
