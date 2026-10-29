import type { BookMeta, BookContentRecord, BookChapter, TOCItem } from '../types';
import { buildLocalXRayIndex } from './localIntelligenceEngine';

function createChapter(
  id: string,
  title: string,
  rawText: string,
  runningCharOffset: { value: number }
): BookChapter {
  const paragraphs = rawText
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean);
  const content = paragraphs.join('\n\n');
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const startLocation = Math.max(1, Math.ceil(runningCharOffset.value / 150));
  runningCharOffset.value += Math.max(150, content.length);
  const endLocation = Math.max(startLocation, Math.ceil(runningCharOffset.value / 150));

  return {
    id,
    title,
    content,
    paragraphs,
    wordCount,
    startLocation,
    endLocation,
  };
}

export function getSeedLibraryData(): {
  metas: BookMeta[];
  contents: BookContentRecord[];
} {
  const rawBooks = [
    {
      id: 'book-meditations',
      title: 'Meditations',
      author: 'Marcus Aurelius',
      description:
        'Private philosophical reflections written by the Roman Emperor during military campaigns along the Danube, exploring Stoic equanimity, providence, and the sovereignty of the rational mind.',
      format: 'epub' as const,
      coverGradient: 'from-stone-800 via-amber-950 to-neutral-950',
      category: 'Philosophy & Stoicism',
      isFavorite: true,
      chapters: [
        {
          title: 'Book I — Debts and Lessons',
          text: `From my grandfather Verus I learned good morals and the government of my temper. From the reputation and remembrance of my father, modesty and a manly character. From my mother, piety and beneficence, and abstinence, not only from evil deeds, but even from evil thoughts; and further, simplicity in my way of living, far removed from the habits of the rich.

From my great-grandfather, not to have frequented public schools, and to have had good teachers at home, and to know that on such things a man should spend liberally. From my governor, to be neither of the green nor of the blue party at the games in the Circus, nor a partisan either of the Parmularius or the Scutarius at the gladiators' fights; from him too I learned endurance of labor, and to want little, and to work with my own hands, and not to meddle with other people's affairs, and not to be ready to listen to slander.

From Diognetus, not to busy myself about trifling things, and not to give credit to what was said by miracle-workers and jugglers about incantations and the driving away of demons and such things; and not to breed quails for fighting, nor to give myself up passionately to such things; and to endure freedom of speech; and to have become intimate with philosophy.

From Rusticus I received the impression that my character required improvement and discipline; and from him I learned not to be led astray to sophistic emulation, nor to writing on speculative matters, nor to delivering little hortatory orations, nor to showing myself off as a man who practices much discipline, or does benevolent acts in order to make a display.

From Apollonius I learned freedom of will and undeviating steadiness of purpose; and to look to nothing else, not even for a moment, except to reason; and to be always the same, in sharp pains, on the occasion of the loss of a child, and in long illness. He taught me how to receive from friends what are esteemed favors, without being either humbled by them or letting them pass unnoticed.

From Sextus, a benevolent disposition, and the example of a family governed in a fatherly manner, and the idea of living conformably to nature; and gravity without affectation, and to look carefully after the interests of friends, and to tolerate ignorant persons, and those who form opinions without consideration.

From Alexander the grammarian, to refrain from fault-finding, and not in a reproachful way to chide those who uttered any barbarous or solecistic or strange-sounding expression; but dexterously to introduce the very expression which ought to have been used, and in the way of answer or giving confirmation, or joining in an inquiry about the thing itself, not about the word.`,
        },
        {
          title: 'Book II — On the River Gran, Among the Quadi',
          text: `Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil. But I who have seen the nature of the good that it is beautiful, and of the bad that it is ugly, and the nature of him who does wrong, that it is akin to me, not only of the same blood or seed, but that it participates in the same intelligence and the same portion of the divinity, I can neither be injured by any of them, for no one can fix on me what is ugly, nor can I be angry with my kinsman, nor hate him.

For we are made for cooperation, like feet, like hands, like the rows of the upper and lower teeth. To act against one another then is contrary to nature; and it is acting against one another to be vexed and to turn away. Whatever this is that I am, it is a little flesh and breath, and the ruling part. Throw away thy books; no longer distract thyself: it is not allowed; but as if thou wast now dying, despise the flesh.

Every moment think steadily as a Roman and a man to do what thou hast in hand with perfect and simple dignity, and feeling of affection, and freedom, and justice; and to give thyself relief from all other thoughts. And thou wilt give thyself relief, if thou doest every act of thy life as if it were the last, laying aside all carelessness and passionate aversion from the commands of reason, and all hypocrisy, and self-love, and discontent with the portion which has been given to thee.

Do wrong to thyself, do wrong to thyself, my soul; but thou wilt no longer have the opportunity of honoring thyself. Every man's life is sufficient. But thine is nearly finished, though thy soul reverences not itself, but places thy felicity in the souls of others. Why do external things distract thee? Give thyself time to learn something new and good, and cease to be whirled around.

Through not observing what is in the mind of another a man has seldom been seen to be unhappy; but those who do not observe the movements of their own minds must of necessity be unhappy. This thou must always bear in mind, what is the nature of the whole, and what is my nature, and how this is related to that, and what kind of a part it is of what kind of a whole; and that there is no one who hinders thee from always doing and saying the things which are according to the nature of which thou art a part.

Though thou shouldst be going to live three thousand years, and as many times ten thousand years, still remember that no man loses any other life than this which he now lives, nor lives any other than this which he now loses. The longest and shortest are thus brought to the same. For the present is the same to all, though that which perishes is not the same; and so that which is lost appears to be a mere moment.`,
        },
        {
          title: 'Book IV — The Inner Citadel',
          text: `Men seek retreats for themselves, houses in the country, sea-shores, and mountains; and thou too art wont to desire such things very much. But this is altogether a mark of the most common sort of men, for it is in thy power whenever thou shalt choose to retire into thyself. For nowhere either with more quiet or more freedom from trouble does a man retire than into his own soul, particularly when he has within him such thoughts that by looking into them he is immediately in perfect tranquility; and I affirm that tranquility is nothing else than the good ordering of the mind.

Constantly then give to thyself this retreat, and renew thyself; and let thy principles be brief and fundamental, which, as soon as thou shalt recur to them, will be sufficient to cleanse the soul completely, and to send thee back free from all discontent with the things to which thou returnest. For with what art thou discontented? With the badness of men? Recall to thy mind this conclusion, that rational animals exist for one another, and that to endure is a part of justice, and that men do wrong involuntarily.

Take away thy opinion, and then there is taken away the complaint, "I have been harmed." Take away the complaint, "I have been harmed," and the harm is taken away. What does not make a man worse than he was, also does not make his life worse, nor does it harm him either from without or from within.

If intellectual capacity is common to us all, the reason also, in respect of which we are rational beings, is common: if this is so, common also is the reason which commands us what to do, and what not to do; if this is so, there is a common law also; if this is so, we are fellow-citizens; if this is so, we are members of some political community; if this is so, the world is in a manner a state.

Death is such as generation is, a mystery of nature; a composition out of the same elements, and a decomposition into the same; and altogether not a thing of which any man should be ashamed, for it is not contrary to the nature of a reasonable animal, and not contrary to the reason of our constitution.

The universe is transformation: life is opinion. Whatever happens at all happens as it should; thou wilt find this true, if thou shouldst watch narrowly. Keep purity of the hegemonikon, the ruling faculty within, untouched by ephemeral praise or blame.`,
        },
      ],
    },
    {
      id: 'book-art-of-war',
      title: 'The Art of War',
      author: 'Sun Tzu',
      description:
        'The classical treatise on strategic calculation, asymmetric positioning, psychological readiness, and winning decisive engagements without unnecessary conflict.',
      format: 'epub' as const,
      coverGradient: 'from-red-950 via-stone-900 to-neutral-950',
      category: 'Strategy & Classics',
      isFavorite: true,
      chapters: [
        {
          title: 'Chapter I — Laying Plans',
          text: `Sun Tzu said: The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.

The art of war, then, is governed by five constant factors, to be taken into account in one's deliberations, when seeking to determine the conditions obtaining in the field. These are: The Moral Law; Heaven; Earth; The Commander; Method and discipline.

The Moral Law causes the people to be in complete accord with their ruler, so that they will follow him regardless of their lives, undismayed by any danger. Heaven signifies night and day, cold and heat, times and seasons. Earth comprises distances, great and small; danger and security; open ground and narrow passes; the chances of life and death. The Commander stands for the virtues of wisdom, sincerity, benevolence, courage and strictness.

By method and discipline are to be understood the marshaling of the army in its proper subdivisions, the graduations of rank among the officers, the maintenance of roads by which supplies may reach the army, and the control of military expenditure. These five heads should be familiar to every general: he who knows them will be victorious; he who knows them not will fail.

Therefore, in your deliberations, when seeking to determine the military conditions, let them be made the basis of a comparison, in this wise: Which of the two sovereigns is imbued with the Moral law? Which of the two generals has most ability? With whom lie the advantages derived from Heaven and Earth? On which side is discipline most rigorously enforced?

All warfare is based on deception. Hence, when able to attack, we must seem unable; when using our forces, we must seem inactive; when we are near, we must make the enemy believe we are far away; when far away, we must make him believe we are near. Hold out baits to entice the enemy. Feign disorder, and crush him. If he is secure at all points, be prepared for him. If he is in superior strength, evade him.`,
        },
        {
          title: 'Chapter III — Attack by Stratagem',
          text: `Sun Tzu said: In the practical art of war, the best thing of all is to take the enemy's country whole and intact; to shatter and destroy it is not so good. So, too, it is better to recapture an army entire than to destroy it, to capture a regiment, a detachment or a company entire than to destroy them.

Hence to fight and conquer in all your battles is not supreme excellence; supreme excellence consists in breaking the enemy's resistance without fighting. Thus the highest form of generalship is to balk the enemy's plans; the next best is to prevent the junction of the enemy's forces; the next in order is to attack the enemy's army in the field; and the worst policy of all is to besiege walled cities.

The rule is, not to besiege walled cities if it can possibly be avoided. The preparation of mantlets, movable shelters, and various implements of war, will take up three whole months; and the piling up of mounds over against the walls will take three months more. The general, unable to control his irritation, will launch his men to the assault like swarming ants, with the result that one-third of his men are slain, while the town still remains untaken.

Therefore the skillful leader subdues the enemy's troops without any fighting; he captures their cities without laying siege to them; he overthrows their kingdom without lengthy operations in the field. With his forces intact he will dispute the mastery of the Empire, and thus, without losing a man, his triumph will be complete.

There are three ways in which a ruler can bring misfortune upon his army: By commanding the army to advance or to retreat, being ignorant of the fact that it cannot obey. This is called hobbling the army. By attempting to govern an army in the same way as he administers a kingdom, being ignorant of the conditions which obtain in an army. This causes restlessness in the soldier's minds.

If you know the enemy and know yourself, you need not fear the result of a hundred battles. If you know yourself but not the enemy, for every victory gained you will also suffer a defeat. If you know neither the enemy nor yourself, you will succumb in every battle.`,
        },
        {
          title: 'Chapter VI — Weak Points and Strong',
          text: `Whoever is first in the field and awaits the coming of the enemy, will be fresh for the fight; whoever is second in the field and has to hasten to battle will arrive exhausted. Therefore the clever combatant imposes his will on the enemy, but does not allow the enemy's will to be imposed on him.

By holding out advantages to him, he can cause the enemy to approach of his own accord; or, by inflicting damage, he can make it impossible for the enemy to draw near. If the enemy is taking his ease, he can harass him; if well supplied with food, he can starve him out; if quietly encamped, he can force him to move.

Appear at points which the enemy must hasten to defend; march swiftly to places where you are not expected. An army may march great distances without distress, if it marches through country where the enemy is not. You can be sure of succeeding in your attacks if you only attack places which are undefended. You can ensure the safety of your defense if you only hold positions that cannot be attacked.

Hence that general is skillful in attack whose opponent does not know what to defend; and he is skillful in defense whose opponent does not know what to attack. O divine art of subtlety and secrecy! Through you we learn to be invisible, through you inaudible; and hence we can hold the enemy's fate in our hands.

If we wish to fight, the enemy can be forced to an engagement even though he be sheltered behind a high rampart and a deep ditch. All we need do is attack some other place that he will be obliged to relieve. If we do not wish to fight, we can prevent the enemy from engaging us even though the lines of our encampment be merely traced out on the ground. All we need do is to throw something odd and unaccountable in his way.

Military tactics are like unto water; for water in its natural course runs away from high places and hastens downwards. So in war, the way is to avoid what is strong and to strike at what is weak. Water shapes its course according to the nature of the ground over which it flows; the soldier works out his victory in relation to the foe whom he is facing. Therefore, just as water retains no constant shape, so in warfare there are no constant conditions.`,
        },
      ],
    },
    {
      id: 'book-walden',
      title: 'Walden; or, Life in the Woods',
      author: 'Henry David Thoreau',
      description:
        'An enduring reflection on deliberate living, self-reliance, and natural observation composed beside Walden Pond in Concord, Massachusetts.',
      format: 'md' as const,
      coverGradient: 'from-emerald-950 via-teal-950 to-stone-950',
      category: 'Essays & Nature',
      isFavorite: false,
      chapters: [
        {
          title: 'Chapter I — Economy',
          text: `When I wrote the following pages, or rather the bulk of them, I lived alone, in the woods, a mile from any neighbor, in a house which I had built myself, on the shore of Walden Pond, in Concord, Massachusetts, and earned my living by the labor of my hands only. I lived there two years and two months. At present I am a sojourner in civilized life again.

I should not obtrude my affairs so much on the notice of my readers if very particular inquiries had not been made by my townsmen concerning my mode of life, which some would call impertinent, though they do not appear to me at all impertinent, but, considering the circumstances, very natural and pertinent.

Most men, even in this comparatively free country, through mere ignorance and mistake, are so occupied with the factitious cares and superfluously coarse labors of life that its finer fruits cannot be plucked by them. Their fingers, from excessive toil, are too clumsy and tremble too much for that. Actually, the laboring man has not leisure for a true integrity day by day; he cannot afford to sustain the manliest relations to men; his labor would be depreciated in the market.

He has no time to be anything but a machine. How can he remember well his ignorance—which his growth requires—who has so often to use his knowledge? We should feed and clothe him gratuitously sometimes, and recruit him with our cordials, before we judge of him. The finest qualities of our nature, like the bloom on fruits, can be preserved only by the most delicate handling.

Near the end of March, 1845, I borrowed an axe and went down to the woods by Walden Pond, nearest to where I intended to build my house, and began to cut down some tall, arrowy white pines, still in their youth, for timber. It is difficult to begin without borrowing, but perhaps it is the most generous course thus to permit your fellow-men to have an interest in your enterprise.

The mass of men lead lives of quiet desperation. What is called resignation is confirmed desperation. From the desperate city you go into the desperate country, and have to console yourself with the bravery of minks and muskrats. A stereotyped but unconscious despair is concealed even under what are called the games and amusements of mankind.

Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand; instead of a million count half a dozen, and keep your accounts on your thumb-nail.`,
        },
        {
          title: 'Chapter II — Where I Lived, and What I Lived For',
          text: `I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms.

Still we live meanly, like ants; though the fable tells us that we were long ago changed into men; like pygmies we fight with cranes; it is error upon error, and clout upon clout, and our best virtue has for its occasion a superfluous and evitable wretchedness. Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest.

Every morning was a cheerful invitation to make my life of equal simplicity, and I may say innocence, with Nature herself. I have been as sincere a worshipper of Aurora as the Greeks. I got up early and bathed in the pond; that was a religious exercise, and one of the best things which I did. Morning brings back the heroic ages.

The millions are awake enough for physical labor; but only one in a million is awake enough for effective intellectual exertion, only one in a hundred millions to a poetic or divine life. To be awake is to be alive. I have never yet met a man who was quite awake. How could I have looked him in the face?

We must learn to reawaken and keep ourselves awake, not by mechanical aids, but by an infinite expectation of the dawn, which does not forsake us in our soundest sleep. I know of no more encouraging fact than the unquestionable ability of man to elevate his life by a conscious endeavor.

Time is but the stream I go a-fishing in. I drink at it; but while I drink I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains.`,
        },
      ],
    },
    {
      id: 'book-relativity',
      title: 'Relativity: The Special and General Theory',
      author: 'Albert Einstein',
      description:
        'Albert Einstein’s lucid exposition of special and general relativity, simultaneous reference frames, the constancy of the speed of light, and curved spacetime geometry.',
      format: 'txt' as const,
      coverGradient: 'from-slate-900 via-indigo-950 to-stone-950',
      category: 'Science & Physics',
      isFavorite: false,
      chapters: [
        {
          title: 'Part I — The Special Theory of Relativity',
          text: `Physical conceptions of space and time begin with the system of coordinates. If I say that a train arrives here at seven o'clock, this means that the exact pointing of the small hand of my watch to seven and the arrival of the train are simultaneous events. Yet simultaneousness becomes subtler when two events occur at distant places along the railway embankment.

Lightning has struck the rails on our railway embankment at two places A and B far distant from each other. I make the additional assertion that these two lightning flashes occurred simultaneously. If I ask you whether there is sense in this statement, you will answer my question with a decided "Yes." Biased by classical mechanics, we assume time is absolute and independent of the state of motion of the body of reference.

Let us imagine a very long train traveling along the rails with the constant velocity v and in the direction from A to B. People traveling in this train will with advantage use the train as a rigid reference-body; they regard all events in reference to the train. Then every event which takes place along the line also takes place at a particular point of the train.

Are two events (for instance the two strokes of lightning A and B) which are simultaneous with reference to the railway embankment also simultaneous relatively to the train? We shall show directly that the answer must be in the negative. When we say that the lightning strokes A and B are simultaneous with respect to the embankment, we mean: the rays of light emitted at the places A and B, where the lightning occurs, meet each other at the mid-point M of the length A to B of the embankment.

But the events A and B also correspond to positions A and B on the train. Let M' be the mid-point of the distance A to B on the traveling train. Just when the flashes of lightning occur, this point M' naturally coincides with the point M, but it moves towards the right with the velocity v of the train. An observer sitting at M' in the train is hastening towards the beam of light coming from B, whilst he is riding on ahead of the beam of light coming from A.

Events which are simultaneous with reference to the embankment are not simultaneous with respect to the train, and vice versa — the relativity of simultaneity. Every reference-body (coordinate system) has its own particular time; unless we are told the reference-body to which the statement of time refers, there is no meaning in a statement of the time of an event.`,
        },
        {
          title: 'Part II — The General Theory of Relativity',
          text: `We imagine a spacious chest resembling a room with an observer inside who is equipped with apparatus. Gravitation naturally does not exist for this observer in free space. To the middle of the lid of the chest is fixed externally a hook with a rope attached, and now a being begins pulling at this with a constant force. The chest together with the observer then begins to move upwards with a uniformly accelerated motion.

How does the man in the chest judge the process? The acceleration of the chest will be transmitted to him by the reaction of the floor of the chest. He must therefore take up this pressure by means of his legs if he does not wish to be laid out full length on the floor. He is then standing in the chest in exactly the same way as anyone stands in a room of a house on our earth.

If he releases a body which he previously had in his hand, the acceleration of the chest will no longer be transmitted to this body, and for this reason the body will approach the floor of the chest with an accelerated relative motion. The observer will further convince himself that the acceleration of the body towards the floor of the chest is always of the same magnitude, whatever kind of body he may happen to use for the experiment.

Relying on his knowledge of the gravitational field, the man in the chest will thus come to the conclusion that he and the chest are in a gravitational field which is constant with regard to time. Of course he will be puzzled for a moment as to why the chest does not fall in this gravitational field. Just then, however, he discovers the hook in the middle of the lid of the chest and the taut rope attached to it, and he consequently comes to the conclusion that the chest is suspended at rest in the gravitational field.

Furthermore, suppose a ray of light is propagated across the chest in a direction perpendicular to the upward acceleration. Relative to the accelerated chest, the path of the light beam is no longer a straight line, but a slightly curved arc bending towards the floor. By the equivalence principle, we deduce that rays of light are likewise deflected when passing through a gravitational field near massive celestial bodies.

Ought we to smile at the man and say that he errs in his conclusion? I do not believe we ought to if we wish to remain consistent; we must rather admit that his mode of grasping the situation violates neither reason nor known mechanical laws. This equivalence of inertial and gravitational mass forms the cornerstone of General Relativity.`,
        },
      ],
    },
  ];

  const metas: BookMeta[] = [];
  const contents: BookContentRecord[] = [];

  rawBooks.forEach((b, idx) => {
    const runningOffset = { value: 0 };
    const chapters = b.chapters.map((ch, cIdx) =>
      createChapter(`ch-${cIdx + 1}`, ch.title, ch.text, runningOffset)
    );
    const totalWords = chapters.reduce((acc, c) => acc + c.wordCount, 0);
    const totalLocations = chapters[chapters.length - 1]?.endLocation || 10;

    const toc: TOCItem[] = chapters.map((ch, cIdx) => ({
      id: ch.id,
      title: ch.title,
      chapterIndex: cIdx,
      level: 0,
    }));

    const xray = buildLocalXRayIndex(b.id, chapters);

    metas.push({
      id: b.id,
      title: b.title,
      author: b.author,
      description: b.description,
      format: b.format,
      coverGradient: b.coverGradient,
      category: b.category,
      isFavorite: b.isFavorite,
      totalWords,
      totalLocations,
      chapterCount: chapters.length,
      addedAt: Date.now() - idx * 3600_000,
      locator: {
        chapterIndex: 0,
        pageIndex: 0,
        paragraphIndex: 0,
        charOffset: 0,
        locationNumber: idx === 0 ? 4 : 1,
        percentage: idx === 0 ? 18 : 0,
        lastReadTimestamp: Date.now() - idx * 7200_000,
      },
    });

    contents.push({
      bookId: b.id,
      chapters,
      toc,
      xray,
    });
  });

  return { metas, contents };
}
