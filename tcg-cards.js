/* Travis: Arena — card data. Monsters are the existing Travis Knox roster (cards.js), adapted into a
   summon-cost format: cost is derived from each character's existing HP/ATK/SPD (same "power score"
   used to balance Story mode bosses — see cards.js), spread evenly across a 1-6 curve, with Taunt
   characters (cards.js tank:true) bumped one cost higher per the brief ("taunt... probably a lot
   higher summon value"). Beer Frog Knox is hard-pinned to cost 1 as the reference example. v1 ships
   monsters as vanilla stats + flavor text only — mechanically triggering all 52 existing Power texts
   is future work; the hand-authored Spells below are where every brief mechanic (AOE, cleanse, extra
   attack, draw/hand effects, sacrifice, dice-roll risk cards) actually runs. See TCG-MODE.md. */
var TCG_MONSTERS = [
 {id:"tadpole-knox",n:"Tadpole Knox",cost:1,atk:2,hp:10,flavor:"Metamorphosis — Bring back one knocked-out character on your team with 8 HP.",img:"images/tadpole-knox.jpg"},
 {id:"outback-knox",n:"Outback Knox",cost:1,atk:4,hp:16,flavor:"Dust Storm — Also makes the target skip its next turn.",img:"images/australiana/outback-knox.jpg"},
 {id:"yearbook-knox",n:"Yearbook Knox",cost:1,atk:3,hp:20,flavor:"Superlative — Choose an enemy. It skips its next turn.",img:"images/end-of-year/yearbook-knox.jpg"},
 {id:"elephant-seal-knox",n:"Elephant Seal Knox",cost:2,atk:3,hp:25,taunt:true,flavor:"Beachmaster — Heal this character back to full HP.",img:"images/elephant-seal-knox.jpg"},
 {id:"staff-meeting-knox",n:"Staff Meeting Knox",cost:1,atk:3,hp:23,flavor:"Agenda Item 14 — Deal 3 damage to one enemy and heal this character 3 HP.",img:"images/staff-meeting-knox.jpg"},
 {id:"sick-day-knox",n:"Sick Day Knox",cost:1,atk:4,hp:21,flavor:"Miraculous Recovery — Heal this character back to full HP.",img:"images/daily-org/sick-day-knox.jpg"},
 {id:"pharaoh-knox",n:"Pharaoh Knox",cost:2,atk:3,hp:25,taunt:true,flavor:"Divine Mandate — Also heals this character 2 HP.",img:"images/knox-of-history/pharaoh-knox.jpg"},
 {id:"doctor-knox",n:"Doctor Knox",cost:1,atk:4,hp:21,flavor:"Peer Review — Choose an enemy. It can&rsquo;t use its Power for the rest of the game.",img:"images/doctor-knox.jpg"},
 {id:"director-knox",n:"Director Knox",cost:1,atk:3,hp:25,flavor:"See Me After Class — Choose an enemy. It skips its next turn.",img:"images/director-knox.jpg"},
 {id:"chaperone-knox",n:"Chaperone Knox",cost:2,atk:4,hp:21,flavor:"Supervision Duty — Every enemy gets &minus;1 ATK for the rest of the game.",img:"images/chaperone-knox.jpg"},
 {id:"field-researcher-knox",n:"Field Researcher Knox",cost:2,atk:4,hp:20,flavor:"Tag and Release — Deal 4 damage to one enemy. It skips its next turn.",img:"images/field-researcher-knox.jpg"},
 {id:"fire-drill-knox",n:"Fire Drill Knox",cost:2,atk:3,hp:21,flavor:"Orderly Exit — Draw 2 action cards.",img:"images/fire-drill-knox.jpg"},
 {id:"parent-teacher-knox",n:"Parent-Teacher Knox",cost:2,atk:4,hp:20,flavor:"Concerns Raised — Swap this character&rsquo;s HP with one enemy&rsquo;s HP.",img:"images/parent-teacher-knox.jpg"},
 {id:"harbour-seal-knox",n:"Harbour Seal Knox",cost:2,atk:4,hp:20,flavor:"Haul Out — This character gets a Shield and heals 3 HP.",img:"images/harbour-seal-knox.jpg"},
 {id:"conference-knox",n:"Conference Knox",cost:2,atk:4,hp:21,flavor:"Keynote — Reveal every face-down enemy, then deal 1 damage to every enemy.",img:"images/conference-knox.jpg"},
 {id:"fur-seal-knox",n:"Fur Seal Knox",cost:2,atk:4,hp:19,flavor:"Territorial Bark — Every enemy gets &minus;1 ATK for the rest of the game.",img:"images/field-season/fur-seal-knox.jpg"},
 {id:"weddell-seal-knox",n:"Weddell Seal Knox",cost:3,atk:3,hp:25,taunt:true,flavor:"Breathing Hole — This character gets a Shield and heals 3 HP.",img:"images/field-season/weddell-seal-knox.jpg"},
 {id:"pd-knox",n:"PD Knox",cost:2,atk:4,hp:21,flavor:"Mandatory Session — Choose an enemy. It skips its next turn.",img:"images/daily-org/pd-knox.jpg"},
 {id:"caesar-knox",n:"Caesar Knox",cost:3,atk:4,hp:21,flavor:"Veni Vidi Vici — Also makes the target skip its next turn.",img:"images/knox-of-history/caesar-knox.jpg"},
 {id:"great-depression-knox",n:"Great Depression Knox",cost:3,atk:4,hp:21,flavor:"Buy the Dip — Also draws an action card.",img:"images/knox-of-history/great-depression-knox.jpg"},
 {id:"napoleon-knox",n:"Napoleon Knox",cost:3,atk:4,hp:22,flavor:"Grand Arm&eacute;e — Also makes the target skip its next turn.",img:"images/knox-of-history/napoleon-knox.jpg"},
 {id:"woodstock-knox",n:"Woodstock Knox",cost:3,atk:4,hp:20,flavor:"Peace Sign — Also gives this character a Shield.",img:"images/knox-of-history/woodstock-knox.jpg"},
 {id:"ww2-knox",n:"WW2 Knox",cost:3,atk:4,hp:21,flavor:"D-Day — Also makes the target skip its next turn.",img:"images/knox-of-history/ww2-knox.jpg"},
 {id:"graduation-knox",n:"Graduation Knox",cost:3,atk:4,hp:19,flavor:"Diploma — This character gets +3 ATK for the rest of the game.",img:"images/end-of-year/graduation-knox.jpg"},
 {id:"family-man-knox",n:"Family Man Knox",cost:3,atk:4,hp:20,flavor:"Huddy &amp; Charlotte — Heal every character on your team 4 HP.",img:"images/family-man-knox.jpg"},
 {id:"yard-duty-knox",n:"Yard Duty Knox",cost:3,atk:3,hp:25,flavor:"Whistle — Remove the Shield from every enemy, then deal 2 damage to one enemy.",img:"images/yard-duty-knox.jpg"},
 {id:"excursion-knox",n:"Excursion Knox",cost:4,atk:4,hp:20,flavor:"Head Count — Draw 2 action cards.",img:"images/daily-org/excursion-knox.jpg"},
 {id:"staff-party-knox",n:"Staff Party Knox",cost:4,atk:5,hp:19,flavor:"Karaoke — Deal 3 damage to one enemy and heal this character 3 HP.",img:"images/end-of-year/staff-party-knox.jpg"},
 {id:"bunnings-bbq-knox",n:"Bunnings BBQ Knox",cost:4,atk:5,hp:17,flavor:"Flip the Snags — This character heals 4 HP.",img:"images/australiana/bunnings-bbq-knox.jpg"},
 {id:"surf-lifesaver-knox",n:"Surf Lifesaver Knox",cost:4,atk:5,hp:17,flavor:"Rip Rescue — First strips the target&rsquo;s Shield, if it has one.",img:"images/australiana/surf-lifesaver-knox.jpg"},
 {id:"blue-suit-knox",n:"Blue Suit Knox",cost:4,atk:6,hp:15,flavor:"Cut of the Cloth — This character gets +3 ATK for the rest of the game.",img:"images/blue-suit-knox.jpg"},
 {id:"research-vessel-knox",n:"Research Vessel Knox",cost:4,atk:4,hp:23,flavor:"All Hands — Every character on your team heals 2 HP.",img:"images/field-season/research-vessel-knox.jpg"},
 {id:"tech-bro-knox",n:"Tech Bro Knox",cost:4,atk:4,hp:21,flavor:"Series A — Also draws an action card.",img:"images/knox-of-history/tech-bro-knox.jpg"},
 {id:"washington-knox",n:"Washington Knox",cost:4,atk:4,hp:24,flavor:"Crossing the Delaware — Also heals this character 2 HP.",img:"images/knox-of-history/washington-knox.jpg"},
 {id:"seal-whisperer-knox",n:"Seal Whisperer Knox",cost:4,atk:4,hp:23,flavor:"Blubber Layer — Give every character on your team a Shield.",img:"images/seal-whisperer-knox.jpg"},
 {id:"mixtape-knox",n:"Mixtape Knox",cost:5,atk:3,hp:25,flavor:"Track Seven — Deal 5 damage to one enemy.",img:"images/mixtape-knox.jpg"},
 {id:"emeritus-knox",n:"Emeritus Knox",cost:5,atk:7,hp:16,flavor:"Tenure — Deal 10 damage to one enemy. This character takes 4 damage.",img:"images/emeritus-knox.jpg"},
 {id:"sports-carnival-knox",n:"Sports Carnival Knox",cost:5,atk:4,hp:22,flavor:"House Captain — Choose another ready character on your team. It attacks an enemy now, then it&rsquo;s done for the round.",img:"images/sports-carnival-knox.jpg"},
 {id:"swimming-carnival-knox",n:"Swimming Carnival Knox",cost:5,atk:4,hp:21,flavor:"Three Laps — Deal 2 damage three times. Choose the enemy each time.",img:"images/swimming-carnival-knox.jpg"},
 {id:"sea-lion-knox",n:"Sea Lion Knox",cost:5,atk:5,hp:20,flavor:"Beach Charge — Attack one enemy for double damage.",img:"images/field-season/sea-lion-knox.jpg"},
 {id:"bushman-knox",n:"Bushman Knox",cost:5,atk:6,hp:17,flavor:"Swag Roll — Also draws an action card.",img:"images/australiana/bushman-knox.jpg"},
 {id:"beer-frog-knox",n:"Beer Frog Knox",cost:1,atk:4,hp:20,flavor:"Amphibious Assault — Deal 2 damage to every enemy.",img:"images/beer-frog-knox.jpg"},
 {id:"pirate-knox",n:"Pirate Knox",cost:5,atk:6,hp:18,flavor:"Boarding Party — First strips the target&rsquo;s Shield, if it has one.",img:"images/knox-of-history/pirate-knox.jpg"},
 {id:"ww1-knox",n:"WW1 Knox",cost:6,atk:5,hp:22,flavor:"No Man&rsquo;s Land — First strips the target&rsquo;s Shield, if it has one.",img:"images/knox-of-history/ww1-knox.jpg"},
 {id:"first-fleet-knox",n:"First Fleet Knox",cost:6,atk:5,hp:19,flavor:"Land Ho — Also gives this character a Shield.",img:"images/australiana/first-fleet-knox.jpg"},
 {id:"socs-got-talent-knox",n:"SOC&rsquo;s Got Talent Knox",cost:6,atk:5,hp:22,flavor:"Encore — Attack twice. Choose the enemy each time.",img:"images/socs-got-talent-knox.jpg"},
 {id:"crusader-knox",n:"Crusader Knox",cost:6,atk:5,hp:24,flavor:"Shield Wall — Also gives this character a Shield.",img:"images/knox-of-history/crusader-knox.jpg"},
 {id:"spartan-knox",n:"Spartan Knox",cost:6,atk:5,hp:24,flavor:"Phalanx — Also gives this character a Shield.",img:"images/knox-of-history/spartan-knox.jpg"},
 {id:"leopard-seal-knox",n:"Leopard Seal Knox",cost:6,atk:8,hp:14,flavor:"Ambush — Attack one enemy for double damage.",img:"images/leopard-seal-knox.jpg"},
 {id:"oakleigh-knox",n:"Oakleigh Knox",cost:6,atk:6,hp:21,flavor:"Extra Chilli — This character takes 2 HP of recoil.",img:"images/australiana/oakleigh-knox.jpg"},
 {id:"samurai-knox",n:"Samurai Knox",cost:6,atk:6,hp:21,flavor:"Iaijutsu Strike — A harder hit. No other effect.",img:"images/knox-of-history/samurai-knox.jpg"},
 {id:"barbarian-knox",n:"Barbarian Knox",cost:6,atk:7,hp:22,flavor:"War Cry — A harder hit. No other effect.",img:"images/knox-of-history/barbarian-knox.jpg"}
];

/* Spells: every brief mechanic lives here, since these are new and fully implemented (see tcg-rules.js
   SPELL_FX). to: 'enemy' | 'friend' | 'any' | 'none' (no target needed). sac: true means it also asks
   you to sacrifice one of your own field monsters as part of its cost. */
var TCG_SPELLS = [
 {id:"food-fight",n:"Food Fight",cost:2,to:"none",txt:"Deal 2 damage to every enemy monster.",flavor:"The cafeteria never recovered."},
 {id:"clean-slate",n:"Clean Slate",cost:2,to:"none",txt:"Remove every buff and debuff from every monster in play.",flavor:"A fresh start. Mostly for show."},
 {id:"double-period",n:"Double Period",cost:3,to:"friend",txt:"A friendly monster may attack again this turn.",flavor:"The bell rings twice today."},
 {id:"pop-quiz",n:"Pop Quiz",cost:1,to:"none",txt:"Draw 2 cards, then discard 1.",flavor:"Nobody studied. Everybody draws anyway."},
 {id:"hall-monitor",n:"Hall Monitor",cost:1,to:"none",txt:"Look at your opponent's hand.",flavor:"Sees the handball court. Sees everything."},
 {id:"group-project",n:"Group Project",cost:2,to:"none",txt:"Copy the last spell either player cast.",flavor:"One person did the work. This card is that person."},
 {id:"written-up",n:"Written Up",cost:1,to:"enemy",txt:"An enemy monster gets &minus;3 ATK until its controller's next turn.",flavor:"Still their turn next. Just a worse one."},
 {id:"faculty-meeting",n:"Faculty Meeting",cost:2,sac:true,to:"enemy",txt:"Sacrifice a friendly monster: deal 6 damage to one enemy.",flavor:"Someone has to be the agenda item."},
 {id:"science-fair-volcano",n:"Science Fair Volcano",cost:2,to:"enemy",txt:"Roll a d20. 15+: double damage. 10&ndash;14: +4 damage. 5&ndash;9: 4 damage to yourself instead. 1&ndash;4: sacrifice your weakest monster and this deals nothing.",flavor:"It erupted. Nobody expected it to actually erupt.",roll:true,base:4},
 {id:"excursion-bus",n:"Excursion Bus",cost:3,to:"friend",txt:"A friendly monster gets +4 HP and Taunt until end of turn — no wait, permanently.",flavor:"Counted to twenty-eight four times. Gets twenty-eight each time."},
 {id:"low-tide",n:"Low Tide",cost:2,to:"none",txt:"Every enemy monster gets &minus;2 ATK this turn.",flavor:"Out of reception. Out of worries."},
 {id:"detention-slip",n:"Detention Slip",cost:1,to:"enemy",txt:"Deal 2 damage to an enemy monster.",flavor:"Two laps of the oval. Non-negotiable."},
 {id:"staffroom-coffee",n:"Staffroom Coffee",cost:2,to:"friendOrNone",txt:"Heal a friendly monster, or your hero if you target nothing, 5 HP.",flavor:"The good machine, not the one in the library."},
 {id:"assembly",n:"Assembly",cost:3,to:"none",txt:"Heal your hero 6 HP and draw a card.",flavor:"Everyone sits cross-legged on principle."}
];

/* Heroes: pick one before the game starts. power.cost spends the same summon-point pool as cards,
   usable once per turn. */
var TCG_HEROES = [
 {id:"doctor-knox",n:"Doctor Knox",hp:30,img:"images/doctor-knox.jpg",
  power:{cost:2,n:"Peer Review",txt:"Deal 3 damage to an enemy monster.",to:"enemy"}},
 {id:"elephant-seal-knox",n:"Elephant Seal Knox",hp:30,img:"images/elephant-seal-knox.jpg",
  power:{cost:2,n:"Beachmaster",txt:"Heal your hero 4 HP.",to:"none"}},
 {id:"beer-frog-knox",n:"Beer Frog Knox",hp:30,img:"images/beer-frog-knox.jpg",
  power:{cost:2,n:"Amphibious Assault",txt:"Deal 1 damage to every enemy monster.",to:"none"}}
];

/* A shared 45-card starter deck (same for both players) — v1 has no deckbuilder, see TCG-MODE.md.
   25 monsters spread across the cost curve (5/5/4/4/4/3 for cost 1-6), all 14 spells, and 6 extra
   copies of the cheapest/most generically useful cards, so the curve plays out smoothly. */
var TCG_DEFAULT_DECK = [
 'tadpole-knox','outback-knox','yearbook-knox','staff-meeting-knox','sick-day-knox',
 'elephant-seal-knox','pharaoh-knox','chaperone-knox','field-researcher-knox','fire-drill-knox',
 'weddell-seal-knox','caesar-knox','great-depression-knox','napoleon-knox',
 'excursion-knox','staff-party-knox','bunnings-bbq-knox','surf-lifesaver-knox',
 'mixtape-knox','emeritus-knox','sports-carnival-knox','swimming-carnival-knox',
 'ww1-knox','first-fleet-knox','socs-got-talent-knox',
 'food-fight','clean-slate','double-period','pop-quiz','hall-monitor','group-project',
 'written-up','faculty-meeting','science-fair-volcano','excursion-bus','low-tide',
 'detention-slip','staffroom-coffee','assembly',
 'beer-frog-knox','doctor-knox','detention-slip','pop-quiz','written-up','staffroom-coffee'
];
if(typeof module!=='undefined') module.exports = {TCG_MONSTERS:TCG_MONSTERS, TCG_SPELLS:TCG_SPELLS, TCG_HEROES:TCG_HEROES, TCG_DEFAULT_DECK:TCG_DEFAULT_DECK};
