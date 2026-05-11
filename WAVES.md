# Wave Reference

## Enemy Types

| Enemy  | Base HP | Speed (px/s) | Notes                          |
|--------|---------|--------------|--------------------------------|
| Grunt  | 90      | 65           | Standard infantry              |
| Runner | 50      | 115          | Fast, fragile                  |
| Tank   | 120     | 50           | Slow, high HP                  |
| Swarm  | 35      | 140          | Always spawns as a group of 3  |

**HP scaling:** every enemy's HP is multiplied by `1.02^(wave − 1)`.  
Examples: ×1.00 at wave 1 · ×1.08 at wave 5 · ×1.20 at wave 10 · ×1.32 at wave 15 · ×1.46 at wave 20.

---

## Map Layouts

| Layout           | Waves  | Canvas    | Description                                                                  |
|------------------|--------|-----------|------------------------------------------------------------------------------|
| Single lane      | 1–4    | 390×500   | One straight vertical lane down the center (x = 195)                        |
| Zigzag           | 5–9    | 390×500   | Two-turn path: top-left ↓ → right ↓ ← left ↓                                |
| Triple lane      | 10–11  | 390×500   | Three parallel vertical lanes (x = 80, 195, 310); enemies cycle lanes       |
| Diamond          | 12–13  | 390×500   | Enter top-center, split into left/right diagonal forks, merge at bottom      |
| Funnel           | 14–15  | 390×500   | Two parallel lanes at top (x = 120, 270) converge to a single center exit   |
| Extended zigzag  | 16–20  | 390×750 ¹ | Three-turn path: top-left ↓ → ↓ ← ↓ → bottom-right; map scrolls vertically |

¹ The 750 px canvas is 50 % taller than the standard canvas. During battle the viewport auto-scrolls to follow the frontmost enemy; during deploy the arena is manually scrollable.

---

## Spawn Timing

| Condition     | First spawn      | Interval between spawn events            |
|---------------|------------------|------------------------------------------|
| Waves 1–5     | 0.6 s            | 1.4 s (fixed)                            |
| Waves 6–20    | 0.6 s            | 0.98–1.82 s (random ±30 % around 1.4 s) |

Swarm counts as **one spawn event** but places **3 entities** on the map simultaneously (staggered 16 px apart along the path).

---

## Wave Table

*Grunt / Runner / Tank columns show **actual enemies on the map**.  
Swarm column shows **spawn events × 3 = entities on map**.*

| Wave | Layout          | Spawn Events | Grunt | Runner | Tank | Swarm (events × 3) | Total on Map | Spawn Interval   | ~Total Spawn Time |
|------|-----------------|:------------:|:-----:|:------:|:----:|:------------------:|:------------:|------------------|:-----------------:|
| 1    | Single lane     | 3            | 3     | —      | —    | —                  | 3            | 1.4 s (fixed)    | ~3.4 s            |
| 2    | Single lane     | 5            | 5     | —      | —    | —                  | 5            | 1.4 s (fixed)    | ~6.2 s            |
| 3    | Single lane     | 5            | 3     | 2      | —    | —                  | 5            | 1.4 s (fixed)    | ~6.2 s            |
| 4    | Single lane     | 7            | 3     | 2      | 2    | —                  | 7            | 1.4 s (fixed)    | ~9.0 s            |
| 5    | Zigzag          | 8            | 2     | 2      | 2    | 2 × 3 = **6**      | 12           | 1.4 s (fixed)    | ~10.4 s           |
| 6    | Zigzag          | 10           | 3     | 3      | 2    | 2 × 3 = **6**      | 14           | 0.98–1.82 s      | ~13 s             |
| 7    | Zigzag          | 12           | 3     | 3      | 3    | 3 × 3 = **9**      | 18           | 0.98–1.82 s      | ~16 s             |
| 8    | Zigzag          | 14           | 4     | 4      | 3    | 3 × 3 = **9**      | 20           | 0.98–1.82 s      | ~19 s             |
| 9    | Zigzag          | 16           | 4     | 4      | 4    | 4 × 3 = **12**     | 24           | 0.98–1.82 s      | ~22 s             |
| 10   | Triple lane     | 18           | 5     | 5      | 4    | 4 × 3 = **12**     | 26           | 0.98–1.82 s      | ~24 s             |
| 11   | Triple lane     | 20           | 5     | 5      | 5    | 5 × 3 = **15**     | 30           | 0.98–1.82 s      | ~27 s             |
| 12   | Diamond         | 22           | 6     | 6      | 5    | 5 × 3 = **15**     | 32           | 0.98–1.82 s      | ~30 s             |
| 13   | Diamond         | 24           | 6     | 6      | 6    | 6 × 3 = **18**     | 36           | 0.98–1.82 s      | ~33 s             |
| 14   | Funnel          | 26           | 7     | 7      | 6    | 6 × 3 = **18**     | 38           | 0.98–1.82 s      | ~36 s             |
| 15   | Funnel          | 28           | 7     | 7      | 7    | 7 × 3 = **21**     | 42           | 0.98–1.82 s      | ~38 s             |
| 16   | Ext. zigzag ¹   | 30           | 8     | 8      | 7    | 7 × 3 = **21**     | 44           | 0.98–1.82 s      | ~41 s             |
| 17   | Ext. zigzag ¹   | 32           | 8     | 8      | 8    | 8 × 3 = **24**     | 48           | 0.98–1.82 s      | ~44 s             |
| 18   | Ext. zigzag ¹   | 34           | 9     | 9      | 8    | 8 × 3 = **24**     | 50           | 0.98–1.82 s      | ~47 s             |
| 19   | Ext. zigzag ¹   | 36           | 9     | 9      | 9    | 9 × 3 = **27**     | 54           | 0.98–1.82 s      | ~50 s             |
| 20   | Ext. zigzag ¹   | 38           | 10    | 10     | 9    | 9 × 3 = **27**     | 56           | 0.98–1.82 s      | ~52 s             |

**~Total Spawn Time** = time from wave start until the last enemy enters the map (first spawn at 0.6 s + remaining intervals at avg 1.4 s). Actual time for waves 6+ varies with the random jitter.

---

## Spawn Order

Enemies are queued by cycling through the available kinds list in order:

| Wave | Cycle pattern (repeating) |
|------|---------------------------|
| 1–2  | Grunt                     |
| 3    | Grunt → Runner            |
| 4    | Grunt → Runner → Tank     |
| 5–20 | Grunt → Runner → Tank → Swarm |

Example (wave 5, 8 events): G · R · T · **S** · G · R · T · **S**
