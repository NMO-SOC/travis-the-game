/* Travis: Arena — card data. Monsters are the existing Travis Knox roster (cards.js), adapted into a
   summon-cost format: cost is derived from each character's existing HP/ATK/SPD (same "power score"
   used to balance Story mode bosses — see cards.js), spread evenly across a 1-6 curve, with Taunt
   characters (cards.js tank:true) bumped one cost higher per the brief ("taunt... probably a lot
   higher summon value"). Beer Frog Knox is hard-pinned to cost 1 as the reference example. v1 ships
   monsters as vanilla stats + flavor text only — mechanically triggering all 52 existing Power texts
   is future work; the hand-authored Spells below are where every brief mechanic (AOE, cleanse, extra
   attack, draw/hand effects, sacrifice, dice-roll risk cards) actually runs. See TCG-MODE.md. */
var TCG_MONSTERS = [
 {id:"tadpole-knox",n:"Tadpole Knox",cost:1,atk:2,hp:3,to:"none",bc:"Battlecry: Return the strongest friendly monster that died this game to your hand.",type:"beast",flavor:"Small now. Destined for legend.",img:"images/tadpole-knox.jpg"},
 {id:"outback-knox",n:"Outback Knox",cost:1,atk:2,hp:5,type:"beast",to:"enemy",bc:"Battlecry: Freeze an enemy monster.",flavor:"Out of reception. Out of worries.",img:"images/australiana/outback-knox.jpg"},
 {id:"yearbook-knox",n:"Yearbook Knox",cost:1,atk:2,hp:4,type:"spirit",flavor:"&ldquo;Most Likely to Mention Seals Unprompted.&rdquo;",img:"images/end-of-year/yearbook-knox.jpg"},
 {id:"elephant-seal-knox",n:"Elephant Seal Knox",cost:2,atk:2,hp:10,taunt:true,type:"beast",flavor:"Two tonnes of disapproval. Mostly nose.",img:"images/elephant-seal-knox.jpg"},
 {id:"staff-meeting-knox",n:"Staff Meeting Knox",cost:1,atk:2,hp:5,type:"staff",flavor:"&ldquo;Just quickly, before we finish&hellip;&rdquo;",img:"images/staff-meeting-knox.jpg"},
 {id:"sick-day-knox",n:"Sick Day Knox",cost:1,atk:2,hp:5,type:"staff",flavor:"Front office rang at 8:05am. Nobody believed the cough.",img:"images/daily-org/sick-day-knox.jpg"},
 {id:"pharaoh-knox",n:"Pharaoh Knox",cost:2,atk:2,hp:8,taunt:true,type:"spirit",to:"none",bc:"Battlecry: Heal your hero 2.",flavor:"Built for eternity. Running fifteen minutes late.",img:"images/knox-of-history/pharaoh-knox.jpg"},
 {id:"doctor-knox",n:"Doctor Knox",cost:1,atk:2,hp:5,type:"scholar",flavor:"&ldquo;I have four hundred pages on seals and I will use them.&rdquo;",img:"images/doctor-knox.jpg"},
 {id:"director-knox",n:"Director Knox",cost:1,atk:2,hp:4,type:"scholar",to:"none",bc:"Battlecry: Scholar monsters you control get +1 ATK this turn.",flavor:"The hallway goes quiet on its own.",img:"images/director-knox.jpg"},
 {id:"chaperone-knox",n:"Chaperone Knox",cost:2,atk:3,hp:5,type:"scholar",flavor:"Leave room for the Journal of Marine Biology.",img:"images/chaperone-knox.jpg"},
 {id:"field-researcher-knox",n:"Field Researcher Knox",cost:2,atk:3,hp:5,to:"enemyOrHero",bc:"Battlecry: Deal 2 damage to an enemy monster or hero.",type:"scholar",flavor:"Tag 041 has been recaptured four times. Rude.",img:"images/field-researcher-knox.jpg"},
 {id:"fire-drill-knox",n:"Fire Drill Knox",cost:2,atk:3,hp:7,to:"none",bc:"Battlecry: Draw a card.",type:"staff",flavor:"Line up. Outside voices outside.",img:"images/fire-drill-knox.jpg"},
 {id:"parent-teacher-knox",n:"Parent-Teacher Knox",cost:2,atk:3,hp:6,type:"staff",flavor:"Ten-minute slots. Forty-minute conversations.",img:"images/parent-teacher-knox.jpg"},
 {id:"harbour-seal-knox",n:"Harbour Seal Knox",cost:2,atk:3,hp:7,to:"none",bc:"Battlecry: Heal your hero 3.",type:"beast",flavor:"Found on the same rock every morning at 7:40.",img:"images/harbour-seal-knox.jpg"},
 {id:"conference-knox",n:"Conference Knox",cost:2,atk:3,hp:7,type:"scholar",flavor:"Forty slides. Thirty-nine about seals.",img:"images/conference-knox.jpg"},
 {id:"fur-seal-knox",n:"Fur Seal Knox",cost:2,atk:3,hp:7,type:"beast",flavor:"Louder than the whole rookery combined.",img:"images/field-season/fur-seal-knox.jpg"},
 {id:"weddell-seal-knox",n:"Weddell Seal Knox",cost:3,atk:3,hp:12,taunt:true,type:"beast",to:"none",bc:"Battlecry: Gain 3 Armor.",flavor:"Files the ice hole under &ldquo;mine.&rdquo;",img:"images/field-season/weddell-seal-knox.jpg"},
 {id:"pd-knox",n:"PD Knox",cost:2,atk:3,hp:6,type:"scholar",flavor:"Third acronym of the slide. Everyone still nodding.",img:"images/daily-org/pd-knox.jpg"},
 {id:"caesar-knox",n:"Caesar Knox",cost:3,atk:4,hp:8,type:"warrior",to:"none",bc:"Battlecry: Gain Poisonous.",flavor:"Crossed the Rubicon. Now crossing the car park.",img:"images/knox-of-history/caesar-knox.jpg"},
 {id:"great-depression-knox",n:"Great Depression Knox",cost:3,atk:4,hp:9,type:"warrior",to:"none",bc:"Battlecry: Draw a card.",flavor:"Bought the top. Sold the bottom. Still smoking a cigar.",img:"images/knox-of-history/great-depression-knox.jpg"},
 {id:"napoleon-knox",n:"Napoleon Knox",cost:3,atk:4,hp:8,type:"warrior",flavor:"Never lost a battle in his own retelling.",img:"images/knox-of-history/napoleon-knox.jpg"},
 {id:"woodstock-knox",n:"Woodstock Knox",cost:3,atk:4,hp:9,type:"spirit",flavor:"Missed the mud. Never missed a chord.",img:"images/knox-of-history/woodstock-knox.jpg"},
 {id:"ww2-knox",n:"WW2 Knox",cost:3,atk:4,hp:7,type:"warrior",flavor:"Landed on the beach. Left with the medal.",img:"images/knox-of-history/ww2-knox.jpg"},
 {id:"graduation-knox",n:"Graduation Knox",cost:3,atk:4,hp:8,type:"spirit",flavor:"Tossed the cap. Never found the cap.",img:"images/end-of-year/graduation-knox.jpg"},
 {id:"family-man-knox",n:"Family Man Knox",cost:3,atk:4,hp:7,type:"staff",to:"none",bc:"Battlecry: Heal your team 2.",flavor:"Outnumbered at home. Undefeated anyway.",img:"images/family-man-knox.jpg"},
 {id:"yard-duty-knox",n:"Yard Duty Knox",cost:3,atk:4,hp:9,to:"none",bc:"Battlecry: Deal 1 damage to all enemy monsters.",type:"staff",flavor:"Sees the handball court. Sees everything.",img:"images/yard-duty-knox.jpg"},
 {id:"excursion-knox",n:"Excursion Knox",cost:4,atk:5,hp:11,type:"staff",to:"none",bc:"Battlecry: Draw a card.",flavor:"Counted to twenty-eight four times. Got twenty-eight each time. Gets a Shield when you play Excursion on it.",img:"images/daily-org/excursion-knox.jpg"},
 {id:"staff-party-knox",n:"Staff Party Knox",cost:4,atk:5,hp:11,type:"spirit",flavor:"Requested the same song three years running.",img:"images/end-of-year/staff-party-knox.jpg"},
 {id:"bunnings-bbq-knox",n:"Bunnings BBQ Knox",cost:4,atk:5,hp:10,type:"staff",flavor:"Red shirt, green apron, one onion short of a system.",img:"images/australiana/bunnings-bbq-knox.jpg"},
 {id:"surf-lifesaver-knox",n:"Surf Lifesaver Knox",cost:4,atk:5,hp:11,type:"staff",flavor:"Between the flags. Always between the flags.",img:"images/australiana/surf-lifesaver-knox.jpg"},
 {id:"blue-suit-knox",n:"Blue Suit Knox",cost:4,atk:5,hp:9,type:"mechanical",flavor:"Nobody has ever seen it wrinkled.",img:"images/blue-suit-knox.jpg"},
 {id:"research-vessel-knox",n:"Research Vessel Knox",cost:4,atk:5,hp:11,type:"staff",to:"none",bc:"Battlecry: Heal your hero 2 and your team 2.",flavor:"Six weeks at sea. Forty thousand photos of seals.",img:"images/field-season/research-vessel-knox.jpg"},
 {id:"tech-bro-knox",n:"Tech Bro Knox",cost:4,atk:5,hp:9,type:"mechanical",to:"none",bc:"Battlecry: Draw a card.",flavor:"Disrupting industries he does not understand.",img:"images/knox-of-history/tech-bro-knox.jpg"},
 {id:"washington-knox",n:"Washington Knox",cost:4,atk:5,hp:10,type:"warrior",to:"none",bc:"Battlecry: Gain 1 summon point this turn.",flavor:"Cannot tell a lie. Excellent at cutting down cherry trees and budgets.",img:"images/knox-of-history/washington-knox.jpg"},
 {id:"seal-whisperer-knox",n:"Seal Whisperer Knox",cost:4,atk:5,hp:10,to:"friend",bc:"Battlecry: Give a friendly monster +3 Health.",type:"staff",flavor:"Counted 212 harbor seals before breakfast.",img:"images/seal-whisperer-knox.jpg"},
 {id:"mixtape-knox",n:"Mixtape Knox",cost:5,atk:6,hp:12,to:"enemyOrHero",bc:"Battlecry: Deal 3 damage to an enemy monster or hero.",type:"spirit",flavor:"Burned with love. Track 7 is the one.",img:"images/mixtape-knox.jpg"},
 {id:"emeritus-knox",n:"Emeritus Knox",cost:5,atk:6,hp:11,to:"enemyOrHero",bc:"Battlecry: Deal 4 damage to an enemy monster or hero. This character takes 2 damage.",type:"spirit",flavor:"Retired. Not finished.",img:"images/emeritus-knox.jpg"},
 {id:"sports-carnival-knox",n:"Sports Carnival Knox",cost:5,atk:6,hp:12,type:"staff",flavor:"Has never once lost the tug of war.",img:"images/sports-carnival-knox.jpg"},
 {id:"swimming-carnival-knox",n:"Swimming Carnival Knox",cost:5,atk:6,hp:11,type:"staff",flavor:"Tumble turns at forty. Still got it.",img:"images/swimming-carnival-knox.jpg"},
 {id:"sea-lion-knox",n:"Sea Lion Knox",cost:5,atk:6,hp:12,type:"beast",to:"none",bc:"Battlecry: Gain Poisonous.",flavor:"The whole colony moves when he does.",img:"images/field-season/sea-lion-knox.jpg"},
 {id:"bushman-knox",n:"Bushman Knox",cost:5,atk:6,hp:12,type:"staff",flavor:"Slept under the stars. Woke up under a ute.",img:"images/australiana/bushman-knox.jpg"},
 {id:"beer-frog-knox",n:"Beer Frog Knox",cost:1,atk:2,hp:5,type:"beast",flavor:"Legend. Menace. Frog.",img:"images/beer-frog-knox.jpg"},
 {id:"pirate-knox",n:"Pirate Knox",cost:5,atk:6,hp:13,type:"warrior",flavor:"All the charisma of a man who has never read the fine print.",img:"images/knox-of-history/pirate-knox.jpg"},
 {id:"ww1-knox",n:"WW1 Knox",cost:6,atk:7,hp:15,type:"warrior",flavor:"Wrote home every week. The trench never wrote back.",img:"images/knox-of-history/ww1-knox.jpg"},
 {id:"first-fleet-knox",n:"First Fleet Knox",cost:6,atk:7,hp:13,type:"staff",flavor:"Eight months at sea for this weather.",img:"images/australiana/first-fleet-knox.jpg"},
 {id:"socs-got-talent-knox",n:"SOC&rsquo;s Got Talent Knox",cost:6,atk:7,hp:13,type:"spirit",flavor:"The judges asked for more. The judges always ask for more.",img:"images/socs-got-talent-knox.jpg"},
 {id:"crusader-knox",n:"Crusader Knox",cost:6,atk:7,hp:13,type:"warrior",to:"none",bc:"Battlecry: Gain 4 Armor.",flavor:"Rode a very long way to argue about real estate.",img:"images/knox-of-history/crusader-knox.jpg"},
 {id:"spartan-knox",n:"Spartan Knox",cost:6,atk:7,hp:14,type:"warrior",to:"none",bc:"Battlecry: Gain 4 Armor.",flavor:"This. Is. The Debbie Locco Centre.",img:"images/knox-of-history/spartan-knox.jpg"},
 {id:"leopard-seal-knox",n:"Leopard Seal Knox",cost:6,atk:7,hp:14,type:"beast",to:"none",bc:"Battlecry: Gain Poisonous.",flavor:"Smiles like that for a reason.",img:"images/leopard-seal-knox.jpg"},
 {id:"oakleigh-knox",n:"Oakleigh Knox",cost:6,atk:7,hp:15,type:"staff",flavor:"Ordered a small. Regrets nothing.",img:"images/australiana/oakleigh-knox.jpg"},
 {id:"samurai-knox",n:"Samurai Knox",cost:6,atk:7,hp:13,type:"warrior",flavor:"Followed the code. The code did not follow him back.",img:"images/knox-of-history/samurai-knox.jpg"},
 {id:"barbarian-knox",n:"Barbarian Knox",cost:6,atk:7,hp:14,type:"warrior",flavor:"Diplomacy is a club he hasn&rsquo;t tried yet.",img:"images/knox-of-history/barbarian-knox.jpg"}
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
 {id:"faculty-meeting",n:"Faculty Meeting",cost:2,sac:true,to:"enemyOrHero",txt:"Sacrifice a friendly monster: deal 6 damage to an enemy monster or hero.",flavor:"Someone has to be the agenda item."},
 {id:"science-fair-volcano",n:"Science Fair Volcano",cost:2,to:"enemyOrHero",txt:"Roll a d20 against an enemy monster or hero. 15+: 8 damage. 10&ndash;14: 5 damage. 5&ndash;9: 4 damage to yourself instead. 1&ndash;4: sacrifice your weakest monster and this deals nothing.",flavor:"It erupted. Nobody expected it to actually erupt.",roll:true,base:4},
 {id:"excursion-bus",n:"Excursion Bus",cost:3,to:"friend",txt:"A friendly monster gets +4 Health and Taunt, permanently.",flavor:"Counted to twenty-eight four times. Gets twenty-eight each time."},
 {id:"low-tide",n:"Low Tide",cost:2,to:"none",txt:"Every enemy monster gets &minus;2 ATK this turn.",flavor:"Out of reception. Out of worries."},
 {id:"detention-slip",n:"Detention Slip",cost:1,to:"enemyOrHero",txt:"Deal 2 damage to an enemy monster or hero.",flavor:"Two laps of the oval. Non-negotiable."},
 {id:"staffroom-coffee",n:"Staffroom Coffee",cost:2,to:"friendOrNone",txt:"Heal a friendly monster, or your hero if you target nothing, 5 HP.",flavor:"The good machine, not the one in the library."},
 {id:"assembly",n:"Assembly",cost:3,to:"none",txt:"Heal your hero 6 HP and draw a card.",flavor:"Everyone sits cross-legged on principle."},
 /* A second wave of spells, one per new keyword, so a deck has real tools to build around: Freeze,
    Poisonous, Armor, Taunt-granting, mana refund/restore, and a type-synergy buff. */
 {id:"extra-credit",n:"Extra Credit",cost:1,to:"none",txt:"Draw a card. If it's a spell, gain 1 extra summon point this turn.",flavor:"Nobody has ever actually needed the extra credit."},
 {id:"recess",n:"Recess",cost:2,to:"none",txt:"Restore 2 summon points this turn.",flavor:"Four minutes of freedom. Spend them wisely."},
 {id:"cold-snap",n:"Cold Snap",cost:2,to:"enemy",txt:"Freeze an enemy monster — it can't attack until its controller's next turn.",flavor:"The reception bars never came back."},
 {id:"venom-vial",n:"Venom Vial",cost:2,to:"friend",txt:"A friendly monster gains Poisonous: any combat damage it deals destroys the target.",flavor:"Labelled, for once, correctly."},
 {id:"shield-duty",n:"Shield Duty",cost:2,to:"friend",txt:"A friendly monster gains 3 Armor.",flavor:"Stands between the handball court and chaos."},
 {id:"house-spirit",n:"House Spirit",cost:3,to:"friend",txt:"Friendly monsters that share a type with the target get +1/+1, permanently.",flavor:"Same house, same colours, same chant."},
 {id:"rally",n:"Rally",cost:2,to:"friend",txt:"A friendly monster gains Taunt.",flavor:"Somebody has to stand at the front of the line."}
];

/* Heroes: pick one before the game starts. power.cost spends the same summon-point pool as cards,
   usable once per turn. */
var TCG_HEROES = [
 {id:"doctor-knox",n:"Doctor Knox",hp:30,img:"images/doctor-knox.jpg",
  power:{cost:2,n:"Peer Review",txt:"Deal 3 damage to an enemy monster or hero.",to:"enemyOrHero"}},
 {id:"elephant-seal-knox",n:"Elephant Seal Knox",hp:30,img:"images/elephant-seal-knox.jpg",
  power:{cost:2,n:"Beachmaster",txt:"Heal your hero 4 HP.",to:"none"}},
 {id:"beer-frog-knox",n:"Beer Frog Knox",hp:30,img:"images/beer-frog-knox.jpg",
  power:{cost:2,n:"Amphibious Assault",txt:"Deal 1 damage to every enemy monster.",to:"none"}}
];

/* A shared 45-card starter deck (same for both players) — v1 has no deckbuilder, see TCG-MODE.md.
   25 monsters spread across the cost curve (5/5/4/4/4/3 for cost 1-6), all 14 spells, and 6 extra
   copies of the cheapest/most generically useful cards, so the curve plays out smoothly. */
var TCG_DEFAULT_DECK = [
 // 25 monsters, 1-6 cost curve, weighted toward the ones with keyword abilities for variety.
 'tadpole-knox','outback-knox','director-knox','staff-meeting-knox','sick-day-knox',
 'elephant-seal-knox','pharaoh-knox','chaperone-knox','field-researcher-knox','fire-drill-knox',
 'weddell-seal-knox','caesar-knox','great-depression-knox','napoleon-knox',
 'excursion-knox','tech-bro-knox','bunnings-bbq-knox','surf-lifesaver-knox',
 'mixtape-knox','emeritus-knox','sea-lion-knox','swimming-carnival-knox',
 'ww1-knox','leopard-seal-knox','spartan-knox',
 // 21 spells (all 14 original + 7 new keyword cards), one each.
 'food-fight','clean-slate','double-period','pop-quiz','hall-monitor','group-project',
 'written-up','faculty-meeting','science-fair-volcano','excursion-bus','low-tide',
 'detention-slip','staffroom-coffee','assembly',
 'extra-credit','recess','cold-snap','venom-vial','shield-duty','house-spirit','rally',
 // A couple of extra copies of generically useful cheap cards, same as before.
 'beer-frog-knox','pop-quiz'
];
if(typeof module!=='undefined') module.exports = {TCG_MONSTERS:TCG_MONSTERS, TCG_SPELLS:TCG_SPELLS, TCG_HEROES:TCG_HEROES, TCG_DEFAULT_DECK:TCG_DEFAULT_DECK};
