#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createLocalKnowledgeGraphService } from "../../libs/knowledge-graph/service.js";
import { detectRepoContext } from "./repo-context.js";

async function main(argv: string[]): Promise<void> {
  const [area, action, ...rest] = argv;
  const service = createLocalKnowledgeGraphService();

  if (area === "init" && action === undefined) {
    const repo = detectRepoContext();
    const result = service.initRepo(repo);
    console.log(result.created ? "Initialized engineering context memory." : "Engineering context memory already initialized.");
    console.log(`Repo: ${repo.repo_name}`);
    console.log(`Remote: ${repo.remote_url}`);
    console.log(`Default branch: ${repo.default_branch}`);
    console.log(`Database: ${result.database_path}`);
    console.log(`Main scope: ${result.main_scope_id}`);
    console.log(`Working scope: ${result.working_scope_id}`);
    return;
  }

  if (area === "graph" && action === "read") {
    const repo = detectRepoContext();
    const graph = service.readGraph(repo);
    console.log("Current graph view: main + working");
    printSection("Components", graph.components, (item) => `${named(item)} ${anchor(item)}`.trim());
    printSection("Flows", graph.flows, named);
    printSection("Claims", graph.claims, (item) => `${field(item, "kind")}: ${field(item, "text")}`);
    printSection("Sources", graph.sources, (item) => `${field(item, "kind")}: ${field(item, "title") || field(item, "ref")}`);
    printSection("Edges", graph.edges, (item) => `${field(item, "from_type")}:${field(item, "from_id")} -[${field(item, "kind")}]-> ${field(item, "to_type")}:${field(item, "to_id")}`);
    return;
  }

  if (area === "graph" && action === "search") {
    const query = rest.join(" ").trim();
    if (query.length === 0) throw new Error("Usage: ec graph search <query>");
    const repo = detectRepoContext();
    const results = service.searchGraph(repo, query);
    if (results.length === 0) {
      console.log("No matching memory found.");
      return;
    }
    console.log(`Found ${results.length} result(s):`);
    for (const result of results) {
      console.log(`- ${result.type}:${result.id} ${result.label}`);
      if (result.text.length > 0) console.log(`  ${result.text}`);
    }
    return;
  }

  if (area === "proposal" && action === "validate") {
    const file = requireFile(rest[0], "Usage: ec proposal validate <file>");
    const repo = detectRepoContext();
    const proposal = readProposal(file);
    const result = service.validateProposal(repo, proposal);
    if (result.valid) {
      console.log("Proposal is valid.");
      return;
    }
    console.log("Proposal is invalid:");
    for (const error of result.errors) console.log(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (area === "proposal" && action === "apply") {
    const file = requireFile(rest[0], "Usage: ec proposal apply <file>");
    const repo = detectRepoContext();
    const proposal = readProposal(file);
    const result = service.applyProposal(repo, proposal);
    console.log("Applied proposal to working memory.");
    console.log(`Memory commit: ${result.memory_commit_id}`);
    console.log(`Scope: ${result.scope_id}`);
    console.log(`Components: ${result.created.components}`);
    console.log(`Flows: ${result.created.flows}`);
    console.log(`Claims: ${result.created.claims}`);
    console.log(`Sources: ${result.created.sources}`);
    console.log(`Edges: ${result.created.edges}`);
    return;
  }

  printHelp();
  process.exitCode = area === undefined ? 0 : 1;
}

function readProposal(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function requireFile(file: string | undefined, usage: string): string {
  if (file === undefined || file.trim().length === 0) throw new Error(usage);
  return file;
}

function printSection<T extends { id: string }>(title: string, items: T[], format: (item: T) => string): void {
  console.log(`${title}: ${items.length}`);
  for (const item of items) {
    console.log(`- ${field(item, "id")} ${format(item)}`.trim());
  }
}

function named(item: { id: string; name?: string }): string {
  return item.name ?? item.id;
}

function anchor(item: object): string {
  const record = item as Record<string, unknown>;
  return typeof record.code_anchor === "string" ? `(${record.code_anchor})` : "";
}

function field(item: object, key: string): string {
  const value = (item as Record<string, unknown>)[key];
  return value === undefined || value === null ? "" : String(value);
}

function printHelp(): void {
  const cli = basename(process.argv[1] ?? "ec");
  console.log(`Usage:
  ${cli} init
  ${cli} graph read
  ${cli} graph search <query>
  ${cli} proposal validate <file>
  ${cli} proposal apply <file>`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
