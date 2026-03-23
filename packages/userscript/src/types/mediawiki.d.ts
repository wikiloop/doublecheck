/** Type declarations for the MediaWiki JS environment (mw global). */

declare namespace mw {
  namespace user {
    function isNamed(): boolean;
    function isTemp(): boolean;
    function isAnon(): boolean;
    function getId(): number;
    function getName(): string | null;
  }

  namespace config {
    function get(key: string): unknown;
    function get(key: "wgUserName"): string | null;
    function get(key: "wgPageName"): string;
    function get(key: "wgAction"): string;
    function get(key: "wgDiffOldId"): number | null;
    function get(key: "wgDiffNewId"): number | null;
    function get(key: "wgRevisionId"): number;
    function get(key: "wgDBname"): string;
    function get(key: "wgServerName"): string;
    function get(key: "wgArticleId"): number;
    function get(key: "wgCanonicalSpecialPageName"): string | null;
    function get(key: "wgTitle"): string;
    function get(key: "wgNamespaceNumber"): number;
  }

  namespace loader {
    function using(modules: string | string[]): Promise<void>;
    function getState(module: string): string | null;
  }

  namespace messages {
    function set(messages: Record<string, string>): void;
  }

  function msg(key: string, ...params: Array<string | number>): string;
  function message(key: string, ...params: Array<string | number>): {
    text(): string;
    exists(): boolean;
  };
}

declare interface Window {
  Vue?: typeof import("vue");
}
