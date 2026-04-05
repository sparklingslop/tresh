#!/usr/bin/env bash
# tmesh viz — sparkling slop mesh visualization
# Reads JSON viz data from stdin, renders with gum
set -euo pipefail

# ---------------------------------------------------------------------------
# Read JSON from stdin
# ---------------------------------------------------------------------------
DATA=$(cat)

identity=$(echo "$DATA" | jq -r '.identity')
inbox_count=$(echo "$DATA" | jq -r '.inboxCount')
total_nodes=$(echo "$DATA" | jq -r '.totalNodes')
timestamp=$(echo "$DATA" | jq -r '.timestamp' | cut -dT -f2 | cut -d. -f1)
node_count=$(echo "$DATA" | jq -r '.nodes | length')
signal_count=$(echo "$DATA" | jq -r '.recentSignals | length')

# ---------------------------------------------------------------------------
# Colors — Sparkling Slop palette
# ---------------------------------------------------------------------------
PINK="#FF6EC7"
PURPLE="#A855F7"
CYAN="#22D3EE"
LIME="#84CC16"
AMBER="#F59E0B"
GRAY="#6B7280"
WHITE="#F9FAFB"
ROSE="#FB7185"
INDIGO="#818CF8"

# ---------------------------------------------------------------------------
# Header — the mesh banner
# ---------------------------------------------------------------------------
LOGO=$(cat <<'LOGO'
 _                        _
| |_ _ __ ___   ___  ___ | |__
| __| '_ ` _ \ / _ \/ __|| '_ \
| |_| | | | | |  __/\__ \| | | |
 \__|_| |_| |_|\___||___/|_| |_|
LOGO
)

header=$(gum style \
  --foreground "$PINK" \
  --bold \
  --border double \
  --border-foreground "$PURPLE" \
  --padding "0 2" \
  --margin "0 0" \
  --align center \
  --width 50 \
  "$LOGO" \
  "" \
  "tmux-native agent mesh")

tagline=$(gum style \
  --foreground "$GRAY" \
  --italic \
  --align center \
  --width 50 \
  "zero infra / zero deps / zero nonsense")

# ---------------------------------------------------------------------------
# Stats bar
# ---------------------------------------------------------------------------
stat_nodes=$(gum style \
  --foreground "$CYAN" \
  --bold \
  --border rounded \
  --border-foreground "$CYAN" \
  --padding "0 1" \
  --width 16 \
  --align center \
  " $total_nodes nodes")

stat_inbox=$(gum style \
  --foreground "$ROSE" \
  --bold \
  --border rounded \
  --border-foreground "$ROSE" \
  --padding "0 1" \
  --width 16 \
  --align center \
  " $inbox_count inbox")

stat_time=$(gum style \
  --foreground "$GRAY" \
  --border rounded \
  --border-foreground "$GRAY" \
  --padding "0 1" \
  --width 16 \
  --align center \
  " $timestamp")

stats_bar=$(gum join --horizontal "$stat_nodes" "$stat_inbox" "$stat_time")

# ---------------------------------------------------------------------------
# This node (self) — the star of the show
# ---------------------------------------------------------------------------
if [ "$inbox_count" -gt 0 ]; then
  inbox_indicator="$inbox_count signal(s) waiting"
  self_border_color="$ROSE"
else
  inbox_indicator="inbox clear"
  self_border_color="$LIME"
fi

self_node=$(gum style \
  --foreground "$WHITE" \
  --bold \
  --border thick \
  --border-foreground "$self_border_color" \
  --padding "0 2" \
  --width 40 \
  --align center \
  " $identity" \
  "this node" \
  "" \
  "$inbox_indicator")

# ---------------------------------------------------------------------------
# Peer nodes
# ---------------------------------------------------------------------------
PEER_BOXES=""

if [ "$node_count" -gt 0 ]; then
  for i in $(seq 0 $((node_count - 1))); do
    peer_id=$(echo "$DATA" | jq -r ".nodes[$i].identity")
    peer_inbox=$(echo "$DATA" | jq -r ".nodes[$i].inboxCount")

    # Alternate colors for visual variety
    case $((i % 4)) in
      0) border_color="$PURPLE" ;;
      1) border_color="$CYAN" ;;
      2) border_color="$INDIGO" ;;
      3) border_color="$AMBER" ;;
    esac

    if [ "$peer_inbox" -gt 0 ]; then
      peer_status="$peer_inbox pending"
    else
      peer_status="idle"
    fi

    peer_box=$(gum style \
      --foreground "$WHITE" \
      --border rounded \
      --border-foreground "$border_color" \
      --padding "0 1" \
      --width 20 \
      --align center \
      "$peer_id" \
      "$peer_status")

    if [ -z "$PEER_BOXES" ]; then
      PEER_BOXES="$peer_box"
    else
      PEER_BOXES=$(gum join --horizontal "$PEER_BOXES" "$peer_box")
    fi
  done
fi

# ---------------------------------------------------------------------------
# Connection visualization
# ---------------------------------------------------------------------------
if [ "$node_count" -gt 0 ]; then
  # Build connection lines
  connectors=""
  for i in $(seq 0 $((node_count - 1))); do
    case $((i % 4)) in
      0) c_char="*" ;;
      1) c_char="+" ;;
      2) c_char="~" ;;
      3) c_char="o" ;;
    esac
    if [ -z "$connectors" ]; then
      connectors="$c_char"
    else
      connectors="$connectors----$c_char"
    fi
  done

  connection_line=$(gum style \
    --foreground "$PURPLE" \
    --faint \
    --align center \
    --width 50 \
    "|" \
    "|" \
    "+-------< mesh >-------+" \
    "|" \
    "+---$connectors---+")
else
  connection_line=$(gum style \
    --foreground "$GRAY" \
    --faint \
    --italic \
    --align center \
    --width 50 \
    "" \
    "no peers discovered" \
    "run: tmesh send <target> to create connections")
fi

# ---------------------------------------------------------------------------
# Recent signals
# ---------------------------------------------------------------------------
SIGNAL_LINES=""
if [ "$signal_count" -gt 0 ]; then
  for i in $(seq 0 $((signal_count - 1))); do
    sig_sender=$(echo "$DATA" | jq -r ".recentSignals[$i].sender")
    sig_type=$(echo "$DATA" | jq -r ".recentSignals[$i].type")
    sig_content=$(echo "$DATA" | jq -r ".recentSignals[$i].content" | head -c 40)
    sig_time=$(echo "$DATA" | jq -r ".recentSignals[$i].timestamp" | cut -dT -f2 | cut -d. -f1)

    SIGNAL_LINES="$SIGNAL_LINES  $sig_time  $sig_sender [$sig_type]  $sig_content
"
  done

  signals_box=$(gum style \
    --foreground "$AMBER" \
    --border rounded \
    --border-foreground "$AMBER" \
    --padding "0 1" \
    --width 50 \
    " Recent Signals" \
    "" \
    "$SIGNAL_LINES")
else
  signals_box=$(gum style \
    --foreground "$GRAY" \
    --faint \
    --border rounded \
    --border-foreground "$GRAY" \
    --padding "0 1" \
    --width 50 \
    --align center \
    "no signals in inbox")
fi

# ---------------------------------------------------------------------------
# Compose the full dashboard
# ---------------------------------------------------------------------------
echo ""
echo "$header"
echo "$tagline"
echo ""
echo "$stats_bar"
echo ""
echo "$self_node"
echo "$connection_line"
if [ -n "$PEER_BOXES" ]; then
  echo "$PEER_BOXES"
fi
echo ""
echo "$signals_box"
echo ""
