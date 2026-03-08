# zsh completion for `bun collect`
#
# Usage: source this file in your .zshrc
#   source /path/to/completions/_bun_collect.zsh

_bun_collect() {
  _arguments -s \
    '--max-pages[最大ページ数]:pages:' \
    '--offset[取得を開始するページ番号]:offset:' \
    '--method[HTTP メソッド]:method:(GET POST PUT PATCH DELETE)' \
    '--dry-run[openapi.yml を書き換えず、スキーマ統計のみ表示]' \
    '--resume[前回中断したスナップショットから再開]' \
    '--sequential[逐次取得モード (プローブベースの判定を使わない)]' \
    '*--param[クエリパラメータを追加]:param:' \
    '--skip[スキップするステップ]:steps:(fetch synthesize schema apidoc filter)' \
    '(--help -h)'{--help,-h}'[ヘルプを表示]'
}

# compdef で上書きする前に、元の bun 補完関数名を退避
typeset -g _bun_collect__orig_comp="${_comps[bun]}"

_bun_with_collect() {
  # words[2]=="collect" かつ3語目以降を補完中の場合のみ独自補完
  if (( CURRENT >= 3 )) && [[ "${words[2]}" == "collect" ]]; then
    words=("${words[@]:1}")   # words[1]=bun を除去
    (( CURRENT -= 1 ))
    _bun_collect
    return
  fi

  # 元の bun 補完を直接呼び出し（_normal 経由だと再帰する）
  if [[ -n "$_bun_collect__orig_comp" ]]; then
    "$_bun_collect__orig_comp" "$@"
  else
    _default
  fi
}

compdef _bun_with_collect bun
