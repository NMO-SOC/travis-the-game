# Travis: The Game — Story Mode

## The premise
Travis Knox starts the year as a graduate teacher with a lanyard, three colleagues who owe him a favour
(Tadpole Knox, Family Man Knox, Field Researcher Knox), and one ambition nobody takes seriously: to be
Principal.

The only way up is through the school. Each faculty has its own culture, its own grudges, and a Head of
Faculty who guards it. Beat a faculty and its best people join you. Beat all four and the Principal
Class has no choice but to hear you out.

Every chapter is a quick **3 v 3**, and there's chance in every attempt. Your three opponents are drawn at random from
that chapter's foe pool, so a retry is never the same fight twice. Boss chapters always include the boss.

Every chapter you clear adds a card to your collection. Clear a faculty by beating its Head, and that
Head of Faculty's card is yours.

---

## Level 1 — Science
*"Hypothesis: I can take this faculty. Method: all of it."*

Travis starts where he's comfortable: the labs, the seals, the smell of formaldehyde.

1. **Prac Report Due** — The lab techs have locked the good equipment away. Get past the prep room.
   *Foe pool:* Doctor Knox, Field Researcher Knox, Tadpole Knox · **Reward:** Harbour Seal Knox
2. **Out on the Ice** — Field trip to the breeding grounds. The seals were here first.
   *Foe pool:* Weddell Seal Knox, Sea Lion Knox, Leopard Seal Knox · **Reward:** Hall Pass *(action: deal 6 damage to one enemy)*
3. **Boss: Head of Science Knox** — Four hundred pages of peer review and a Bunsen burner that's
   never been turned off.
   *Foe pool:* Head of Science Knox, Elephant Seal Knox, Research Vessel Knox · **Reward:** Head of Science Knox

## Level 2 — Maths
*"Show your working."*

Maths runs on rules, timetables and the one photocopier that works. They don't like surprises.

1. **Show Your Working** — Staff Meeting Knox has an agenda item. It is you.
   *Foe pool:* Staff Meeting Knox, Director Knox, Chaperone Knox, Emeritus Knox · **Reward:** Conference Knox
2. **Reports Are Due** — Every comment bank in the building has been deleted. Someone has to pay.
   *Foe pool:* PD Knox, Sick Day Knox, Yard Duty Knox, Blue Suit Knox · **Reward:** Staffroom Coffee *(action: heal every character on your team 4 HP)*
3. **Boss: Head of Maths Knox** — Has calculated your odds. Won't tell you what they are.
   *Foe pool:* Head of Maths Knox, Director Knox, Staff Meeting Knox, PD Knox · **Reward:** Head of Maths Knox

## Level 3 — English
*"It's not what you say. It's the subtext."*

English is all drama: the school play, the yearbook, and a staffroom where every sentence is a
metaphor for something worse.

1. **The School Production** — Opening night. The lead has quit. The understudy is a seal.
   *Foe pool:* SOC's Got Talent Knox, Mixtape Knox, Parent-Teacher Knox, Beer Frog Knox, Swimming Carnival Knox, Family Man Knox · **Reward:** Yearbook Knox
2. **Yearbook Deadline** — Everyone wants their quote changed. Nobody gets their quote changed.
   *Foe pool:* Yearbook Knox, Graduation Knox, Staff Party Knox, Excursion Knox, Fire Drill Knox, Sports Carnival Knox · **Reward:** Relief Teacher *(action: one character gets +3 ATK for the game)*
3. **Boss: Head of English Knox** — Has marked your life as "developing". Wants a rewrite by Friday.
   *Foe pool:* Head of English Knox, Parent-Teacher Knox, Yearbook Knox, Mixtape Knox, SOC's Got Talent Knox, Staff Party Knox · **Reward:** Head of English Knox

## Level 4 — Humanities
*"Those who don't learn from history get it on the exam."*

Humanities doesn't just teach history. It *is* history. The Year 9 project got out of hand and now
the corridor is full of emperors.

1. **History Repeats** — Caesar and Napoleon have formed a committee. It is already a coup.
   *Foe pool:* Caesar Knox, Napoleon Knox, Samurai Knox, Spartan Knox, Pirate Knox, Barbarian Knox · **Reward:** Washington Knox
2. **The Great Debate** — Geography versus Economics versus Legal Studies. Travis is the moderator. The moderator is the target.
   *Foe pool:* Great Depression Knox, Tech Bro Knox, Woodstock Knox, Crusader Knox, WW1 Knox, WW2 Knox · **Reward:** Long Weekend *(action: a Shield and 5 HP for one character)*
3. **Boss: Head of Humanities Knox** — Has seen empires fall. Has not seen one like yours.
   *Foe pool:* Head of Humanities Knox, Pharaoh Knox, Caesar Knox, Napoleon Knox, Washington Knox, Spartan Knox · **Reward:** Head of Humanities Knox

---

## Finale — The Principal Class
*"The door at the end of the hall is always open. That is the problem."*

Four faculties. Four Heads who now answer to Travis. The Principal Class calls an emergency meeting,
and Travis walks in uninvited.

1. **Assistant Principals** — Two of them, one clipboard each, and a roster that has somehow put
   Travis on yard duty for the rest of his life.
   *Foe pool:* Wellbeing AP Knox, Curriculum AP Knox, Director Knox, Yard Duty Knox, Staff Meeting Knox, Conference Knox · **Reward:** none, the finale is the reward
2. **Final Boss: Principal Knox** — The Principal has been expecting this since your first day. The
   whole school is watching from the gym.
   *Foe pool:* Principal Knox, both Assistant Principals, and three Heads of Faculty (Science, Maths, Humanities) who were pressured into switching sides

### Ending
Principal Knox falls. The PA crackles. The lanyard changes colour.

**Travis Knox becomes Principal.**

His first act: seals are now a compulsory subject. His second act: he books the staffroom for a
meeting about it. Nobody comes. It's perfect.

**Reward:** *Principal Travis Knox*, a unique card.

---

## New characters

Eight new cards. Stats follow the game's formula in `cards.js`:
- **Jab** = ATK.
- **Signature** = ATK × 1.4, or just ATK if the signature is a stun.
- **Overdrive** = ATK × 2, and the character takes some damage back.
- Signature effects can be `heal`, `shield`, `stun`, `unshield` (strip a shield), `draw` (draw a card) or none.

Characters from story mode can be used online once won, so these are balanced against existing rares
(the normal roster tops out at 25 HP). The bosses feel tougher in story mode because of the team around them.

**Image style** (to match `images/knox-of-history/caesar-knox.jpg` and `images/daily-org/pd-knox.jpg`):
Semi-realistic painterly portrait of the same man as the reference photo, from the waist up, warm
cinematic lighting, visible brushwork, a detailed setting behind him. Portrait orientation (2:3,
e.g. 800×1200). Saved as PNG. No text or logos in the image.

### Head of Science Knox
| Field | Value |
|---|---|
| id | `head-of-science-knox` |
| Role line | Faculty of Science |
| HP / ATK / SPD | 24 / 4 / 4 |
| Signature | **Controlled Experiment** — `unshield` (strips the target's Shield first) |
| Flavour | "Results are preliminary. Your defeat is not." |
| Image file | `images/story/head-of-science-knox.jpg` |

**Image prompt:** The man from the reference photo as a Head of Science, wearing a white lab coat over a
shirt and tie, safety goggles pushed up on his forehead, holding a bubbling conical flask with a blue
glow. Behind him, a school science lab with Bunsen burners, a periodic table poster, and a seal skull on
a specimen shelf. A confident half-smile.

### Head of Maths Knox
| Field | Value |
|---|---|
| id | `head-of-maths-knox` |
| Role line | Faculty of Mathematics |
| HP / ATK / SPD | 23 / 4 / 5 |
| Signature | **Show Your Working** — `stun` (the target skips its next turn) |
| Flavour | "He has calculated your odds. He will not be sharing them." |
| Image file | `images/story/head-of-maths-knox.jpg` |

**Image prompt:** The man from the reference photo as a Head of Maths, in a cardigan and collared shirt,
a graphics calculator in one hand and a red marking pen behind his ear. Behind him, a classroom
whiteboard covered in equations, graphs and one circled answer, with a timetable pinned to the wall.
A raised eyebrow, unimpressed.

### Head of English Knox
| Field | Value |
|---|---|
| id | `head-of-english-knox` |
| Role line | Faculty of English |
| HP / ATK / SPD | 22 / 5 / 5 |
| Signature | **Red Pen** — `draw` (also draws an action card) |
| Flavour | "Marked: developing. See comments." |
| Image file | `images/story/head-of-english-knox.jpg` |

**Image prompt:** The man from the reference photo as a Head of English, wearing a tweed blazer with elbow
patches and a loosened tie, holding an open annotated novel in one hand and a red pen in the other.
Behind him, a book-lined English staffroom, stacks of essays, and a theatre-production poster on the
wall. A dramatic, theatrical expression.

### Head of Humanities Knox
| Field | Value |
|---|---|
| id | `head-of-humanities-knox` |
| Role line | Faculty of Humanities |
| HP / ATK / SPD | 25 / 3 / 3 |
| Signature | **Primary Source** — `shield` (also gives this character a Shield) |
| Flavour | "Has seen empires fall. Has marked their essays." |
| Image file | `images/story/head-of-humanities-knox.jpg` |

**Image prompt:** The man from the reference photo as a Head of Humanities, in a waistcoat and bow tie,
one hand resting on an antique globe, a rolled-up old map under his arm. Behind him, a classroom
filled with history posters, a Roman bust, a world map with pins, and faint ghostly figures of
emperors and generals in the background haze. A knowing, scholarly look.

### Wellbeing AP Knox
| Field | Value |
|---|---|
| id | `wellbeing-ap-knox` |
| Role line | Assistant Principal, Wellbeing |
| HP / ATK / SPD | 22 / 4 / 4 |
| Signature | **Restorative Conversation** — `heal` (also heals this character) |
| Flavour | "How are we feeling about losing?" |
| Image file | `images/story/wellbeing-ap-knox.jpg` |

**Image prompt:** The man from the reference photo as an Assistant Principal for Wellbeing, in a soft
knit jumper with a school lanyard, holding a mug of tea and a box of tissues. Behind him, a calm
office with beanbags, a "Growth Mindset" poster, indoor plants, and a closed door marked "Wellbeing".
A warm but slightly unsettling, too-patient smile.

### Curriculum AP Knox
| Field | Value |
|---|---|
| id | `curriculum-ap-knox` |
| Role line | Assistant Principal, Curriculum |
| HP / ATK / SPD | 22 / 5 / 3 |
| Signature | **Timetable Clash** — `stun` (the target skips its next turn) |
| Flavour | "You've been timetabled for yard duty. Permanently." |
| Image file | `images/story/curriculum-ap-knox.jpg` |

**Image prompt:** The man from the reference photo as an Assistant Principal for Curriculum, in a navy suit
with a lanyard full of keys, holding a clipboard with a colour-coded timetable. Behind him, an office
wall covered in a giant whole-school timetable, sticky notes, and a printer spitting out paper.
A stern, efficient expression.

### Principal Knox *(final boss)*
| Field | Value |
|---|---|
| id | `principal-knox` |
| Role line | The Office at the End of the Hall |
| HP / ATK / SPD | 26 / 5 / 4 |
| Signature | **My Office. Now.** — `stun` (the target skips its next turn) |
| Flavour | "The door is always open. That is the problem." |
| Image file | `images/story/principal-knox.jpg` |

**Image prompt:** The man from the reference photo as the outgoing School Principal, an older-looking,
imposing version of him in a charcoal three-piece suit with a gold school pin, seated behind a large
wooden desk with his fingers steepled. Behind him, a wood-panelled office, framed honour boards,
a school crest, and a window with dark storm clouds. Dramatic low light, a cold, calculating stare.

### Principal Travis Knox *(final reward, unique)*
| Field | Value |
|---|---|
| id | `principal-travis-knox` |
| Role line | Principal, at Last |
| HP / ATK / SPD | 25 / 5 / 5 |
| Signature | **Whole-School Assembly** — `heal` (also heals this character) |
| Flavour | "First order of business: seals are now a compulsory subject." |
| Image file | `images/story/principal-travis-knox.jpg` |

**Image prompt:** The man from the reference photo triumphant as the new School Principal, in a sharp navy
suit and a gold Principal's lanyard, standing on the stage of a school gymnasium at a lectern with the
school crest. A seal plush sits on the lectern. Behind him, rows of cheering students and staff, gold
confetti in the air, and a banner reading nothing (leave the banner blank). Heroic golden stage
lighting, a proud grin.

---

## In code
- Chapters: `STORY` in `cards.js`. Rewards are also listed in `supabase/upgrade-21-story-mode.sql`, which must stay in the same order.
- Characters: the `set:"story"` entries in `cards.js`, with images in `images/story/`.
- Heads of Faculty and Principal Travis Knox join your collection. The Assistant Principals and Principal Knox are opponents only.
