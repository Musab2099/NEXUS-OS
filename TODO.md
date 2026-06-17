# TODO — Muscle Ranking System

## Step 1
- Inspect `gym.html` structure and choose insertion point for the new ranking UI.

## Step 2
- Implement UI in `gym.html`:
  - Top section: muscle mapping (left) + rank card (right) with SVG crest + TikTok watermark.
  - Bottom section: 9-tier hierarchy panel with hex/crest badges and active highlight.

## Step 3
- Implement local JS model in `gym.html`:
  - `muscle_rank_v1` data (rank name, LP, exercise, weight, RPE).
  - Render active rank in the card and highlight the matching tier.

## Step 4
- Sanity check:
  - Verify `gym.html` loads without JS errors.
  - Ensure responsive layout on smaller screens.

