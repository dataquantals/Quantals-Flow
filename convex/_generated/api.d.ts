/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as boards from "../boards.js";
import type * as crm from "../crm.js";
import type * as files from "../files.js";
import type * as invoices from "../invoices.js";
import type * as knowledge from "../knowledge.js";
import type * as leads from "../leads.js";
import type * as leaf from "../leaf.js";
import type * as migrations from "../migrations.js";
import type * as notepad from "../notepad.js";
import type * as osWorkspace from "../osWorkspace.js";
import type * as projectPlanning from "../projectPlanning.js";
import type * as quotations from "../quotations.js";
import type * as sessions from "../sessions.js";
import type * as userFiles from "../userFiles.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  boards: typeof boards;
  crm: typeof crm;
  files: typeof files;
  invoices: typeof invoices;
  knowledge: typeof knowledge;
  leads: typeof leads;
  leaf: typeof leaf;
  migrations: typeof migrations;
  notepad: typeof notepad;
  osWorkspace: typeof osWorkspace;
  projectPlanning: typeof projectPlanning;
  quotations: typeof quotations;
  sessions: typeof sessions;
  userFiles: typeof userFiles;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
