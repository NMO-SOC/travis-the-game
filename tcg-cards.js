/* Travis: Arena — card data. Monsters are the existing Travis Knox roster (cards.js), adapted into a
   summon-cost format: cost is derived from each character's existing HP/ATK/SPD (same "power score"
   used to balance Story mode bosses — see cards.js), spread evenly across a 1-6 curve, with Taunt
   characters (cards.js tank:true) bumped one cost higher per the brief ("taunt... probably a lot
   higher summon value"). Beer Frog Knox is hard-pinned to cost 1 as the reference example. v1 ships
   monsters as vanilla stats + flavor text only — mechanically triggering all 52 existing Power texts
   is future work; the hand-authored Spells below are where every brief mechanic (AOE, cleanse, extra
   attack, draw/hand effects, sacrifice, dice-roll risk cards) actually runs. See TCG-MODE.md. */
var TCG_MONSTERS = [
 {id:"tadpole-knox",n:"Tadpole Knox",cost:1,atk:2,hp:10,to:"none",bc:"Battlecry: Return the strongest friendly monster that died this game to your hand.",flavor:"Small now. Destined for legend.",img:"images/tadpole-knox.jpg"},
 {id:"outback-knox",n:"Outback Knox",cost:1,atk:4,hp:16,flavor:"Out of reception. Out of worries.",img:"images/australiana/outback-knox.jpg"},
 {id:"yearbook-knox",n:"Yearbook Knox",cost:1,atk:3,hp:20,flavor:"&ldquo;Most Likely to Mention Seals Unprompted.&rdquo;",img:"images/end-of-year/yearbook-knox.jpg"},
 {id:"elephant-seal-knox",n:"Elephant Seal Knox",cost:2,atk:3,hp:25,taunt:true,flavor:"Two tonnes of disapproval. Mostly nose.",img:"images/elephant-seal-knox.jpg"},
 {id:"staff-meeting-knox",n:"Staff Meeting Knox",cost:1,atk:3,hp:23,flavor:"&ldquo;Just quickly, before we finish&hellip;&rdquo;",img:"images/staff-meeting-knox.jpg"},
 {id:"sick-day-knox",n:"Sick Day Knox",cost:1,atk:4,hp:21,flavor:"Front office rang at 8:05am. Nobody believed the cough.",img:"images/daily-org/sick-day-knox.jpg"},
 {id:"pharaoh-knox",n:"Pharaoh Knox",cost:2,atk:3,hp:25,taunt:true,flavor:"Built for eternity. Running fifteen minutes late.",img:"images/knox-of-history/pharaoh-knox.jpg"},
 {id:"doctor-knox",n:"Doctor Knox",cost:1,atk:4,hp:21,flavor:"&ldquo;I have four hundred pages on seals and I will use them.&rdquo;",img:"images/doctor-knox.jpg"},
 {id:"director-knox",n:"Director Knox",cost:1,atk:3,hp:25,flavor:"The hallway goes quiet on its own.",img:"images/director-knox.jpg"},
 {id:"chaperone-knox",n:"Chaperone Knox",cost:2,atk:4,hp:21,flavor:"Leave room for the Journal of Marine Biology.",img:"images/chaperone-knox.jpg"},
 {id:"field-researcher-knox",n:"Field Researcher Knox",cost:2,atk:4,hp:20,to:"enemy",bc:"Battlecry: Deal 2 damage to an enemy monster.",flavor:"Tag 041 has been recaptured four times. Rude.",img:"images/field-researcher-knox.jpg"},
 {id:"fire-drill-knox",n:"Fire Drill Knox",cost:2,atk:3,hp:21,to:"none",bc:"Battlecry: Draw a card.",flavor:"Line up. Outside voices outside.",img:"images/fire-drill-knox.jpg"},
 {id:"parent-teacher-knox",n:"Parent-Teacher Knox",cost:2,atk:4,hp:20,flavor:"Ten-minute slots. Forty-minute conversations.",img:"images/parent-teacher-knox.jpg"},
 {id:"harbour-seal-knox",n:"Harbour Seal Knox",cost:2,atk:4,hp:20,to:"none",bc:"Battlecry: Heal your hero 3.",flavor:"Found on the same rock every morning at 7:40.",img:"images/harbour-seal-knox.jpg"},
 {id:"conference-knox",n:"Conference Knox",cost:2,atk:4,hp:21,flavor:"Forty slides. Thirty-nine about seals.",img:"images/conference-knox.jpg"},
 {id:"fur-seal-knox",n:"Fur Seal Knox",cost:2,atk:4,hp:19,flavor:"Louder than the whole rookery combined.",img:"images/field-season/fur-seal-knox.jpg"},
 {id:"weddell-seal-knox",n:"Weddell Seal Knox",cost:3,atk:3,hp:25,taunt:true,flavor:"Files the ice hole under &ldquo;mine.&rdquo;",img:"images/field-season/weddell-seal-knox.jpg"},
 {id:"pd-knox",n:"PD Knox",cost:2,atk:4,hp:21,flavor:"Third acronym of the slide. Everyone still nodding.",img:"images/daily-org/pd-knox.jpg"},
 {id:"caesar-knox",n:"Caesar Knox",cost:3,atk:4,hp:21,flavor:"Crossed the Rubicon. Now crossing the car park.",img:"images/knox-of-history/caesar-knox.jpg"},
 {id:"great-depression-knox",n:"Great Depression Knox",cost:3,atk:4,hp:21,flavor:"Bought the top. Sold the bottom. Still smoking a cigar.",img:"images/knox-of-history/great-depression-knox.jpg"},
 {id:"napoleon-knox",n:"Napoleon Knox",cost:3,atk:4,hp:22,flavor:"Never lost a battle in his own retelling.",img:"images/knox-of-history/napoleon-knox.jpg"},
 {id:"woodstock-knox",n:"Woodstock Knox",cost:3,atk:4,hp:20,flavor:"Missed the mud. Never missed a chord.",img:"images/knox-of-history/woodstock-knox.jpg"},
 {id:"ww2-knox",n:"WW2 Knox",cost:3,atk:4,hp:21,flavor:"Landed on the beach. Left with the medal.",img:"images/knox-of-history/ww2-knox.jpg"},
 {id:"graduation-knox",n:"Graduation Knox",cost:3,atk:4,hp:19,flavor:"Tossed the cap. Never found the cap.",img:"images/end-of-year/graduation-knox.jpg"},
 {id:"family-man-knox",n:"Family Man Knox",cost:3,atk:4,hp:20,flavor:"Outnumbered at home. Undefeated anyway.",img:"images/family-man-knox.jpg"},
 {id:"yard-duty-knox",n:"Yard Duty Knox",cost:3,atk:3,hp:25,to:"none",bc:"Battlecry: Deal 1 damage to all enemy monsters.",flavor:"Sees the handball court. Sees everything.",img:"images/yard-duty-knox.jpg"},
 {id:"excursion-knox",n:"Excursion Knox",cost:4,atk:4,hp:20,flavor:"Counted to twenty-eight four times. Got twenty-eight each time. Gets a Shield when you play Excursion on it.",img:"images/daily-org/excursion-knox.jpg"},
 {id:"staff-party-knox",n:"Staff Party Knox",cost:4,atk:5,hp:19,flavor:"Requested the same song three years running.",img:"images/end-of-year/staff-party-knox.jpg"},
 {id:"bunnings-bbq-knox",n:"Bunnings BBQ Knox",cost:4,atk:5,hp:17,flavor:"Red shirt, green apron, one onion short of a system.",img:"images/australiana/bunnings-bbq-knox.jpg"},
 {id:"surf-lifesaver-knox",n:"Surf Lifesaver Knox",cost:4,atk:5,hp:17,flavor:"Between the flags. Always between the flags.",img:"images/australiana/surf-lifesaver-knox.jpg"},
 {id:"blue-suit-knox",n:"Blue Suit Knox",cost:4,atk:6,hp:15,flavor:"Nobody has ever seen it wrinkled.",img:"images/blue-suit-knox.jpg"},
 {id:"research-vessel-knox",n:"Research Vessel Knox",cost:4,atk:4,hp:23,flavor:"Six weeks at sea. Forty thousand photos of seals.",img:"images/field-season/research-vessel-knox.jpg"},
 {id:"tech-bro-knox",n:"Tech Bro Knox",cost:4,atk:4,hp:21,flavor:"Disrupting industries he does not understand.",img:"images/knox-of-history/tech-bro-knox.jpg"},
 {id:"washington-knox",n:"Washington Knox",cost:4,atk:4,hp:24,flavor:"Cannot tell a lie. Excellent at cutting down cherry trees and budgets.",img:"images/knox-of-history/washington-knox.jpg"},
 {id:"seal-whisperer-knox",n:"Seal Whisperer Knox",cost:4,atk:4,hp:23,to:"friend",bc:"Battlecry: Give a friendly monster +3 Health.",flavor:"Counted 212 harbor seals before breakfast.",img:"images/seal-whisperer-knox.jpg"},
 {id:"mixtape-knox",n:"Mixtape Knox",cost:5,atk:3,hp:25,to:"enemy",bc:"Battlecry: Deal 3 damage to an enemy monster.",flavor:"Burned with love. Track 7 is the one.",img:"images/mixtape-knox.jpg"},
 {id:"emeritus-knox",n:"Emeritus Knox",cost:5,atk:7,hp:16,to:"enemy",bc:"Battlecry: Deal 4 damage to an enemy monster. This character takes 2 damage.",flavor:"Retired. Not finished.",img:"images/emeritus-knox.jpg"},
 {id:"sports-carnival-knox",n:"Sports Carnival Knox",cost:5,atk:4,hp:22,flavor:"Has never once lost the tug of war.",img:"images/sports-carnival-knox.jpg"},
 {id:"swimming-carnival-knox",n:"Swimming Carnival Knox",cost:5,atk:4,hp:21,flavor:"Tumble turns at forty. Still got it.",img:"images/swimming-carnival-knox.jpg"},
 {id:"sea-lion-knox",n:"Sea Lion Knox",cost:5,atk:5,hp:20,flavor:"The whole colony moves when he does.",img:"images/field-season/sea-lion-knox.jpg"},
 {id:"bushman-knox",n:"Bushman Knox",cost:5,atk:6,hp:17,flavor:"Slept under the stars. Woke up under a ute.",img:"images/australiana/bushman-knox.jpg"},
 {id:"beer-frog-knox",n:"Beer Frog Knox",cost:1,atk:4,hp:20,flavor:"Legend. Menace. Frog.",img:"images/beer-frog-knox.jpg"},
 {id:"pirate-knox",n:"Pirate Knox",cost:5,atk:6,hp:18,flavor:"All the charisma of a man who has never read the fine print.",img:"images/knox-of-history/pirate-knox.jpg"},
 {id:"ww1-knox",n:"WW1 Knox",cost:6,atk:5,hp:22,flavor:"Wrote home every week. The trench never wrote back.",img:"images/knox-of-history/ww1-knox.jpg"},
 {id:"first-fleet-knox",n:"First Fleet Knox",cost:6,atk:5,hp:19,flavor:"Eight months at sea for this weather.",img:"images/australiana/first-fleet-knox.jpg"},
 {id:"socs-got-talent-knox",n:"SOC&rsquo;s Got Talent Knox",cost:6,atk:5,hp:22,flavor:"The judges asked for more. The judges always ask for more.",img:"images/socs-got-talent-knox.jpg"},
 {id:"crusader-knox",n:"Crusader Knox",cost:6,atk:5,hp:24,flavor:"Rode a very long way to argue about real estate.",img:"images/knox-of-history/crusader-knox.jpg"},
 {id:"spartan-knox",n:"Spartan Knox",cost:6,atk:5,hp:24,flavor:"This. Is. The Debbie Locco Centre.",img:"images/knox-of-history/spartan-knox.jpg"},
 {id:"leopard-seal-knox",n:"Leopard Seal Knox",cost:6,atk:8,hp:14,flavor:"Smiles like that for a reason.",img:"images/leopard-seal-knox.jpg"},
 {id:"oakleigh-knox",n:"Oakleigh Knox",cost:6,atk:6,hp:21,flavor:"Ordered a small. Regrets nothing.",img:"images/australiana/oakleigh-knox.jpg"},
 {id:"samurai-knox",n:"Samurai Knox",cost:6,atk:6,hp:21,flavor:"Followed the code. The code did not follow him back.",img:"images/knox-of-history/samurai-knox.jpg"},
 {id:"barbarian-knox",n:"Barbarian Knox",cost:6,atk:7,hp:22,flavor:"Diplomacy is a club he hasn&rsquo;t tried yet.",img:"images/knox-of-history/barbarian-knox.jpg"}
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
 {id:"science-fair-volcano",n:"Science Fair Volcano",cost:2,to:"enemy",txt:"Roll a d20. 15+: 8 damage. 10&ndash;14: 5 damage. 5&ndash;9: 4 damage to yourself instead. 1&ndash;4: sacrifice your weakest monster and this deals nothing.",flavor:"It erupted. Nobody expected it to actually erupt.",roll:true,base:4},
 {id:"excursion-bus",n:"Excursion Bus",cost:3,to:"friend",txt:"A friendly monster gets +4 Health and Taunt, permanently.",flavor:"Counted to twenty-eight four times. Gets twenty-eight each time."},
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
