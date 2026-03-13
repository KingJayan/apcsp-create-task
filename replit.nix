{ pkgs }: {
    deps = [
      pkgs.psmisc
      pkgs.nodePackages.vscode-langservers-extracted
      pkgs.nodePackages.typescript-language-server
    ];
  }