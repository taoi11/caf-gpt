/**
 * tools/oxlint/anti-slop/shared/type-alias-resolution.ts
 *
 * Shared lexical type-alias resolution: collects type bindings per program and matches types
 * after resolving visible aliases and substituting their type parameters.
 *
 * Top-level declarations:
 * - VisitorKeys / TypeScope / TypeBinding / Substitution / Substitutions: Internal resolution types
 * - TypeAliasEnvironment: Collected aliases and type bindings of one program
 * - ResolvedTypeMatcher: Callback that matches a resolved type
 * - environmentsByProgram: Per-program environment cache
 * - isNode: Checks whether a value is an ESTree node
 * - enclosingTypeScope: Finds the block-like scope that owns a declaration
 * - declaredTypeBinding: Reads the type name a declaration or import introduces
 * - collectTypeBindings: Walks the AST collecting type bindings and aliases
 * - createTypeAliasEnvironment: Builds (and caches) the environment for a program
 * - ancestorDistance: Counts parent steps from a node up to an ancestor
 * - nearestTypeBindings: Returns the innermost visible bindings for a name
 * - visibleTypeAlias: Resolves the nearest visible alias with a name
 * - hasVisibleTypeBinding: Checks whether a local declaration shadows a type name
 * - typeReferenceName: Reads the identifier name of a type reference
 * - aliasSubstitutions: Maps an alias's type parameters to a reference's arguments or defaults
 * - resolvedTypeMatches: Matches a type after alias resolution and substitution
 */

import type { ESTree } from "@oxlint/plugins";

import { lexicalTypeParameterNames } from "./lexical-type-parameters.ts";

type VisitorKeys = Readonly<Record<string, readonly string[]>>;
type TypeScope = ESTree.Node;

type TypeBinding = {
  readonly alias: ESTree.TSTypeAliasDeclaration | null;
  readonly name: string;
  readonly scope: TypeScope;
};

type Substitution = {
  readonly substitutions: Substitutions;
  readonly type: ESTree.TSType;
};

type Substitutions = ReadonlyMap<string, Substitution>;

export type TypeAliasEnvironment = {
  readonly aliases: readonly ESTree.TSTypeAliasDeclaration[];
  readonly bindingsByName: ReadonlyMap<string, readonly TypeBinding[]>;
  readonly visitorKeys: VisitorKeys;
};

export type ResolvedTypeMatcher = (
  type: ESTree.TSType,
  matches: (child: ESTree.TSType) => boolean
) => boolean;

const environmentsByProgram = new WeakMap<ESTree.Program, TypeAliasEnvironment>();

/** Return whether a visitor-key field value is an ESTree node. */
function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

/** Return the nearest program, block, module block, static block or switch owning a declaration. */
function enclosingTypeScope(node: ESTree.Node): TypeScope {
  let current: ESTree.Node | null = node.parent;
  while (current !== null) {
    if (
      current.type === "Program" ||
      current.type === "BlockStatement" ||
      current.type === "TSModuleBlock" ||
      current.type === "StaticBlock" ||
      current.type === "SwitchStatement"
    ) {
      return current;
    }
    current = current.parent;
  }
  return node;
}

/** Return the type name a type alias, interface, enum, class or import introduces, if any. */
function declaredTypeBinding(node: ESTree.Node): {
  readonly alias: ESTree.TSTypeAliasDeclaration | null;
  readonly name: string;
} | null {
  if (node.type === "TSTypeAliasDeclaration") {
    return { alias: node, name: node.id.name };
  }
  if (
    node.type === "TSInterfaceDeclaration" ||
    node.type === "TSEnumDeclaration" ||
    node.type === "ClassDeclaration" ||
    node.type === "ClassExpression"
  ) {
    return node.id === null ? null : { alias: null, name: node.id.name };
  }
  if (
    node.type === "ImportSpecifier" ||
    node.type === "ImportDefaultSpecifier" ||
    node.type === "ImportNamespaceSpecifier"
  ) {
    return { alias: null, name: node.local.name };
  }
  return null;
}

/** Walk a subtree by visitor keys, recording every type binding and type alias. */
function collectTypeBindings(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  bindingsByName: Map<string, TypeBinding[]>,
  aliases: ESTree.TSTypeAliasDeclaration[]
): void {
  const declared = declaredTypeBinding(node);
  if (declared !== null) {
    const bindings = bindingsByName.get(declared.name) ?? [];
    bindings.push({ ...declared, scope: enclosingTypeScope(node) });
    bindingsByName.set(declared.name, bindings);
    if (declared.alias !== null) aliases.push(declared.alias);
  }

  // SAFETY: Oxlint's visitor keys identify only ESTree child-node properties.
  const fields = node as unknown as Readonly<Record<string, unknown>>;
  for (const key of visitorKeys[node.type] ?? []) {
    const value = fields[key];
    if (isNode(value)) {
      collectTypeBindings(value, visitorKeys, bindingsByName, aliases);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const child of value) {
      if (isNode(child)) {
        collectTypeBindings(child, visitorKeys, bindingsByName, aliases);
      }
    }
  }
}

/** Collect every lexical type alias and competing type binding in a program. */
export function createTypeAliasEnvironment(
  program: ESTree.Program,
  visitorKeys: VisitorKeys
): TypeAliasEnvironment {
  const cached = environmentsByProgram.get(program);
  if (cached !== undefined) return cached;
  const bindingsByName = new Map<string, TypeBinding[]>();
  const aliases: ESTree.TSTypeAliasDeclaration[] = [];
  collectTypeBindings(program, visitorKeys, bindingsByName, aliases);
  const environment = { aliases, bindingsByName, visitorKeys };
  environmentsByProgram.set(program, environment);
  return environment;
}

/** Return the number of parent steps from a node to an ancestor, or null when it is not one. */
function ancestorDistance(ancestor: ESTree.Node, node: ESTree.Node): number | null {
  let current: ESTree.Node | null = node;
  let distance = 0;
  while (current !== null) {
    if (current === ancestor) return distance;
    current = current.parent;
    distance += 1;
  }
  return null;
}

/** Return the bindings for a name in the innermost scope enclosing the use. */
function nearestTypeBindings(
  name: string,
  use: ESTree.Node,
  environment: TypeAliasEnvironment
): readonly TypeBinding[] {
  const candidates = environment.bindingsByName.get(name) ?? [];
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearest: TypeBinding[] = [];
  for (const candidate of candidates) {
    const distance = ancestorDistance(candidate.scope, use);
    if (distance === null || distance > nearestDistance) continue;
    if (distance === nearestDistance) {
      nearest.push(candidate);
      continue;
    }
    nearestDistance = distance;
    nearest = [candidate];
  }
  return nearest;
}

/** Resolve the nearest visible alias with this name, respecting lexical shadowing. */
export function visibleTypeAlias(
  name: string,
  use: ESTree.Node,
  environment: TypeAliasEnvironment
): ESTree.TSTypeAliasDeclaration | null {
  if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) return null;
  const bindings = nearestTypeBindings(name, use, environment);
  return bindings.length === 1 ? (bindings[0]?.alias ?? null) : null;
}

/** Return whether a local declaration shadows a built-in type at this use. */
export function hasVisibleTypeBinding(
  name: string,
  use: ESTree.Node,
  environment: TypeAliasEnvironment
): boolean {
  return (
    lexicalTypeParameterNames(use, environment.visitorKeys).has(name) ||
    nearestTypeBindings(name, use, environment).length > 0
  );
}

/** Return a type reference's simple identifier name, or null for qualified names. */
function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

/** Map an alias's type parameters to the reference's arguments or defaults; null when one is missing. */
function aliasSubstitutions(
  alias: ESTree.TSTypeAliasDeclaration,
  reference: ESTree.TSTypeReference,
  base: Substitutions
): Substitutions | null {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = reference.typeArguments?.params ?? [];
  const next = new Map(base);
  for (const [index, parameter] of parameters.entries()) {
    const explicitArgument = arguments_[index];
    const argument = explicitArgument ?? parameter.default;
    if (argument === null || argument === undefined) return null;
    const argumentSubstitutions = explicitArgument === undefined ? next : base;
    next.set(parameter.name.name, {
      type: argument,
      substitutions: new Map(argumentSubstitutions),
    });
  }
  return next;
}

/** Match a type after resolving visible aliases and substituting their type parameters. */
export function resolvedTypeMatches(
  type: ESTree.TSType,
  environment: TypeAliasEnvironment,
  matcher: ResolvedTypeMatcher
): boolean {
  const evaluate = (
    current: ESTree.TSType,
    substitutions: Substitutions,
    resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>
  ): boolean => {
    if (current.type === "TSTypeReference") {
      const name = typeReferenceName(current);
      if (name !== null) {
        const substitution = substitutions.get(name);
        if (substitution !== undefined && !current.typeArguments?.params.length) {
          return evaluate(substitution.type, substitution.substitutions, resolvingAliases);
        }
        const alias = visibleTypeAlias(name, current, environment);
        if (alias !== null && !resolvingAliases.has(alias)) {
          const nextSubstitutions = aliasSubstitutions(alias, current, substitutions);
          if (nextSubstitutions !== null) {
            const nextResolving = new Set(resolvingAliases);
            nextResolving.add(alias);
            return evaluate(alias.typeAnnotation, nextSubstitutions, nextResolving);
          }
        }
      }
    }
    return matcher(current, (child) => evaluate(child, substitutions, resolvingAliases));
  };

  return evaluate(type, new Map(), new Set());
}
