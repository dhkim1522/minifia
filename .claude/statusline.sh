#!/bin/bash
# macOS(bash)와 Windows(Git Bash) 공용. jq 없이 grep·sed 로 필요한 필드만 읽는다.
in=$(cat | tr -d '\n\r')
[ -n "$STATUSLINE_DEBUG" ] && printf '%s\n' "$in" > "$STATUSLINE_DEBUG"
now=$(date +%s)
fmt() { # seconds -> 1h57m / 3d15h
  local s=$1; [ "$s" -lt 0 ] && s=0
  if [ "$s" -ge 86400 ]; then echo "$((s/86400))d$((s%86400/3600))h"
  elif [ "$s" -ge 3600 ]; then echo "$((s/3600))h$((s%3600/60))m"
  else echo "$((s/60))m"; fi
}
col() { # pct -> color
  local p=${1%.*}; [ -z "$p" ] && p=0
  if [ "$p" -ge 80 ]; then printf '\033[31m'; elif [ "$p" -ge 50 ]; then printf '\033[33m'; else printf '\033[32m'; fi
}
obj() { # 키 이름 -> 그 객체 본문 (중첩 없는 객체만)
  printf '%s' "$in" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*{[^}]*}" | head -1
}
num() { # 텍스트, 키 -> 숫자 값
  printf '%s' "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*-\{0,1\}[0-9][0-9.eE+-]*" | head -1 | sed 's/.*:[[:space:]]*//'
}
str() { # 텍스트, 키 -> 문자열 값
  printf '%s' "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
}
int() { printf '%.0f' "$1"; }
model=$(str "$(obj model)" display_name)
h5o=$(obj five_hour); h5=$(num "$h5o" used_percentage); h5r=$(num "$h5o" resets_at)
wko=$(obj seven_day); wk=$(num "$wko" used_percentage); wkr=$(num "$wko" resets_at)
dur=$(num "$(obj cost)" total_duration_ms)
ctx=$(num "$(obj context_window)" used_percentage)
eff=$(str "$(obj effort)" level); [ -z "$eff" ] && eff=$(str "$in" effortLevel)
R='\033[0m'; C='\033[36m'; D='\033[90m'
out="${D}|${R} Model: ${C}${model}${R}"
if [ -n "$h5" ]; then out+=" ${D}|${R} 5h:$(col $h5)$(int "$h5")%${R}"; [ -n "$h5r" ] && out+="(${D}$(fmt $(( $(int "$h5r") - now )))${R})"; fi
if [ -n "$wk" ]; then out+=" ${D}|${R} wk:$(col $wk)$(int "$wk")%${R}"; [ -n "$wkr" ] && out+="(${D}$(fmt $(( $(int "$wkr") - now )))${R})"; fi
[ -n "$dur" ] && out+=" ${D}|${R} session:${C}$(fmt $(( $(int "$dur") / 1000 )))${R}"
[ -n "$ctx" ] && out+=" ${D}|${R} ctx:$(col $ctx)$(int "$ctx")%${R}"
[ -n "$eff" ] && out+=" ${D}|${R} effort:${C}${eff}${R}"
printf '%b\n' "$out"
