"""Original, deterministic spoken prose. Facts and choices remain owned by story.py."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .story import Memory


OPENING = {
    "archivist": (
        "Blackthorn House: unoccupied for forty years, according to the record. Yet a lamp burns upstairs. "
        "Your invitation bears tomorrow's date and your own handwriting. I would preserve that discrepancy. "
        "The door closes. A brass key, a girl's defaced portrait, small bare footprints in the dust. "
        "Behind the walls, something counts backward. 'Observe before you touch,' I tell you. "
        "A house is an archive. Someone has been removing the names."
    ),
    "skeptic": (
        "Working hypothesis: somebody wants to frighten you. Blackthorn House has been empty for forty years, "
        "but a lamp is on. Your invitation has tomorrow's date and your handwriting. A forgery, presumably. "
        "The door shuts. On the table are a brass key and a girl's portrait with the name scratched out; "
        "small bare footprints cross the dust. Something counts backward inside the walls. "
        "'Pipes,' I say. 'Or a recording. We check the evidence, then we leave.'"
    ),
    "medium": (
        "There is a child here. Blackthorn House has stood empty for forty years, but her waiting fills it. "
        "A lamp burns upstairs. Your invitation carries tomorrow's date, written in your own hand. "
        "'Stay where you can hear me,' I whisper as the door closes. A brass key rests beside a girl's "
        "portrait; someone has wounded the paint where her name should be. Small bare footprints disturb "
        "the dust. Something counts backward in the walls. I feel her flinch at every number."
    ),
}

DISCOVERY = {
    "archivist": {
        "key": "The brass key warms in your palm. Its teeth match the painted lock: a peculiar annotation.",
        "name": "Beneath the damaged portrait you recovered Eleanor's name. An erasure is not an absence.",
        "steps": "The small footprints led you here. Their route identifies floorboards the house cannot hear.",
    },
    "skeptic": {
        "key": "The brass key is warm. Its teeth match a lock painted on the wall. A concealed mechanism, perhaps.",
        "name": "You recovered Eleanor's name from the scratched portrait. At least paint obeys ordinary rules.",
        "steps": "The footprints led you here, over boards the house cannot hear. I dislike that last conclusion.",
    },
    "medium": {
        "key": "The brass key warms against your skin. Its teeth match the painted lock, as if the house wants you closer.",
        "name": "You found Eleanor's name beneath the scratches. I feel her listening when you carry it into the gallery.",
        "steps": "The footprints led you here, along boards the house cannot hear. She has shown us how to be quiet.",
    },
}

GALLERY = {
    "archivist": (
        "A child presses her palm against the inside of a mirror. 'He made me promise to stay. The bell remembers "
        "every promise.' I note the wording: made me. Beneath her reflection a black ledger lies open, with a "
        "narrow stair descending behind it. 'Before we inherit a history, we should discover who wrote it.'"
    ),
    "skeptic": (
        "A child presses her palm against the inside of a mirror. There is no room behind the glass. "
        "'He made me promise to stay,' she says. 'The bell remembers every promise.' 'Projection,' I start, "
        "then lose the rest of the sentence. A black ledger lies open below her; a narrow stair descends behind it. "
        "We can question her, inspect the ledger, or find an exit. Evidence first. Please."
    ),
    "medium": (
        "A child presses her hand against the mirror from within. I feel the cold where your palm would meet hers. "
        "'He made me promise to stay. The bell remembers every promise.' Her voice is small; the listening behind "
        "it is enormous. A black ledger lies open beneath her reflection, a narrow stair behind it. "
        "'Do not promise from pity,' I tell you. 'She will feel the difference when you leave.'"
    ),
}

ACCESS = {
    "archivist": {
        "key": "The brass key opens the belfry; you return it to your coat. Its purpose is now established.",
        "name": "Whispering Eleanor's name opens the belfry. Some locks preserve a name instead of a mechanism.",
        "steps": "The silent floorboards lead through a servant's passage into the belfry. An overlooked route in an old plan.",
    },
    "skeptic": {
        "key": "The brass key opens the belfry. You keep it in your coat. One object, at least, does what it should.",
        "name": "You whisper Eleanor's name and the belfry opens. No latch moves. My explanation does not survive that.",
        "steps": "You take the silent floorboards through a servant's passage to the belfry. I count our steps to steady myself.",
    },
    "medium": {
        "key": "The brass key opens the belfry. You tuck it into your coat; I feel the house notice that you kept it.",
        "name": "You whisper Eleanor's name. The belfry opens like a held breath finally released.",
        "steps": "The quiet boards carry you through a servant's passage into the belfry. I follow the shape of her absence.",
    },
}

RELATIONSHIP = {
    "archivist": {
        "trust": "The girl's voice follows you; she is relying on your promise. I record an obligation, not an ornament.",
        "debt": "The ledger revealed the keeper's bargain: one keeper leaves only when another takes their place.",
        "exit": "You located a window overlooking the garden. Its latch opens from inside; it is still bolted.",
    },
    "skeptic": {
        "trust": "The girl's voice follows because you promised to help. I wish we had established what help would cost.",
        "debt": "The ledger was explicit: a keeper can leave only when a replacement stays. This is a trap with written terms.",
        "exit": "You found a window above the garden, still bolted from inside. I keep that practical fact close.",
    },
    "medium": {
        "trust": "The girl's voice follows the warmth of your promise. I can feel how completely she believes you.",
        "debt": "The ledger named the bargain: a keeper leaves only when another stays. Its loneliness has rules.",
        "exit": "You found a window above the garden, its latch still bolted inside. Beyond it, the living world feels very far away.",
    },
}

BELFRY = {
    "archivist": (
        "A silver bell hangs above a circle of ash. The former keeper speaks through the floor: 'Ring it, and take "
        "responsibility for what answers.' Beside it is the girl's ribbon, tied in an impossible knot. "
        "'An anchor, an office, an escape,' I murmur. 'Three different ways to alter the record.'"
    ),
    "skeptic": (
        "A silver bell hangs over a circle of ash. The former keeper's voice rises through solid floorboards: "
        "'Ring it, and take responsibility for what answers.' That is not acoustics. Beside the bell, the girl's "
        "ribbon holds an impossible knot. 'Do something,' I whisper. 'Untie it. Ring the bell. Open the window. Just choose.'"
    ),
    "medium": (
        "A silver bell hangs over ash. The former keeper speaks through the floor: 'Ring it, and take responsibility "
        "for what answers.' Beside the bell, the girl's ribbon knots around a grief I can almost touch. "
        "'That is what holds her,' I whisper. 'The bell wants a keeper. She wants someone to come back for her.'"
    ),
}

CONSEQUENCE = {
    "archivist": {
        "ribbon": "The ribbon is free. The girl steps out of the mirror for the first time in forty years. An anchor has been broken.",
        "bell": "The bell has named you. Doors turn toward you like listening faces. Authority has acknowledged its candidate.",
        "window": "The garden window stands open. Cold air enters the house; an escape route is prepared, not yet taken.",
    },
    "skeptic": {
        "ribbon": "The ribbon is free. The girl steps out of the mirror. Forty years, and now there are footprints on our side.",
        "bell": "The bell has named you. Every door turns toward you. Wood cannot look at someone. It is looking at you.",
        "window": "The garden window is open. Cold air touches your face. An exit. A real exit. I nearly beg you to take it.",
    },
    "medium": {
        "ribbon": "The ribbon is free. The girl steps out of the mirror after forty years. For one moment, her hope hurts more than her grief.",
        "bell": "The bell has named you. Every door turns to listen. I feel the house trying the shape of your heartbeat.",
        "window": "The garden window is open. Cold air carries the smell of living things. The girl feels you thinking of leaving.",
    },
}

RECKONING = {
    "archivist": (
        "The house offers its final bargain. Thousands of stolen heartbeats fall silent behind the plaster. "
        "'We have reached the unwritten page,' I tell you. 'An account of what happened is not an answer to what happens next.'"
    ),
    "skeptic": (
        "Thousands of stolen heartbeats stop behind the plaster. The house waits for your final answer. "
        "'I was wrong,' I say. No pipes, no projection, no explanation left between us and this thing. "
        "I am frightened. That does not make your choice for you."
    ),
    "medium": (
        "Thousands of stolen heartbeats fall quiet behind the plaster. The house offers its last bargain. "
        "'It can feel what you want,' I whisper. 'That does not mean it understands love. Show it the difference.'"
    ),
}

TRUST_AT_RECKONING = {
    "archivist": "The girl reaches for the hand you promised her. Your earlier words remain part of the record.",
    "skeptic": "The girl reaches for the hand you promised her. I cannot calculate a way to make that promise weigh less.",
    "medium": "The girl reaches for the hand you promised her. I feel her waiting for you to mean it again.",
}
DISTANCE_AT_RECKONING = {
    "archivist": "The girl watches. You made no promise; there is still a choice to record.",
    "skeptic": "The girl watches. You made no promise to her. I find that less reassuring than I expected.",
    "medium": "The girl watches from the edge of your silence. You made no promise, but she has not stopped hoping.",
}

ENDING_OPEN = {
    "archivist": {
        "liberation": "You take the girl's hand and cross the threshold together. The ribbon dissolves in the dawn. Every locked room opens. Blackthorn House is only a house.",
        "escape": "You slip through the {route} as the house draws breath. Morning finds you alive on the road. Survival is a fact; its price needs a separate entry.",
        "inheritance": "You accept the keeper's place. The walls settle around your heartbeat; dust rises into constellations. Every locked door opens at your thought. Custody has passed to you.",
    },
    "skeptic": {
        "liberation": "You take the girl's hand and cross the threshold together. The ribbon dissolves in daylight. Every locked room opens. The house is only a house. I wait for a qualification. None comes.",
        "escape": "You scramble through the {route} as the house takes a breath. On the road, you count your own heartbeats. Alive. I can establish that much. I cannot establish that we are safe.",
        "inheritance": "You accept. The walls settle around your heartbeat. Dust rises into constellations; every locked door opens when you think of it. 'No,' I say, too late. You have become the explanation.",
    },
    "medium": {
        "liberation": "You take the girl's hand and cross the threshold together. The ribbon dissolves in the dawn. Every locked room opens. The house is only a house; I can finally feel where its grief ends.",
        "escape": "You slip through the {route} while the house takes a breath. Morning finds you on the road. You are alive. I feel the space where another hand might have rested in yours.",
        "inheritance": "You accept. The house settles around your heartbeat. Dust becomes constellations; locked doors open at your thought. 'I can still hear you,' I whisper. Your pulse is everywhere now.",
    },
}

FIRST_RECOLLECTION = {
    "archivist": {
        "key": "The brass key is still in your coat. You kept the first piece of evidence.",
        "name": "You preserved Eleanor's name when someone had tried to erase it. That discovery cannot be taken back.",
        "steps": "You remember the silent passage the small footprints revealed. The house had a history beneath its official doors.",
    },
    "skeptic": {
        "key": "The brass key is still in your coat. You trusted something you could hold; it did not explain what held her.",
        "name": "You recovered Eleanor's name from the portrait. A real child, not an optical effect. I will not call her that again.",
        "steps": "The silent passage you found by following the footprints was real. So was the child who left them.",
    },
    "medium": {
        "key": "The brass key is still in your coat. You held it before you knew whose loneliness it would unlock.",
        "name": "You kept Eleanor's name safe after the portrait had tried to lose it. I still feel her turn toward its sound.",
        "steps": "You followed the small footprints into the silent passage. Someone waiting to be found showed you the way.",
    },
}

PROMISE_END = {
    "archivist": {
        "liberation": "You kept your promise to the girl. For once, an obligation ends without passing to another keeper.",
        "escape": "You broke your promise to the girl. I leave that sentence intact; survival does not amend it.",
        "inheritance_free": "You kept your promise to help, at the cost of your own freedom. Record both parts of that exchange.",
        "inheritance_bound": "You broke your promise to help her leave. A new keeper is not the freedom you offered.",
    },
    "skeptic": {
        "liberation": "You kept your promise to the girl. I could not prove it would work. You did it anyway.",
        "escape": "You broke your promise to the girl. I argued for an exit. I have no argument that excuses this.",
        "inheritance_free": "You kept your promise to help her, and surrendered your own exit. I understand the cost. I cannot make it smaller.",
        "inheritance_bound": "You broke your promise to help her leave. Calling this responsibility will not change the result.",
    },
    "medium": {
        "liberation": "You kept your promise to the girl. I feel her trust become something lighter than waiting.",
        "escape": "You broke your promise to the girl. Her silence follows you; I can feel exactly whom it belongs to.",
        "inheritance_free": "You kept your promise to her by giving up your own way out. I feel relief and grief occupying the same room.",
        "inheritance_bound": "You broke your promise to free her. Her trust goes quiet, and the house mistakes that quiet for peace.",
    },
}

OTHER_END = {
    "archivist": {
        "debt": "You read the keeper's bargain before this decision. You knew a keeper leaves only when someone stays.",
        "exit_open": "You located an exit, then opened it yourself. Preparation became a choice with consequences.",
        "exit_closed": "You located an exit but left its latch bolted. Knowing a route and opening it were different decisions.",
        "ribbon_escape": "You untied the ribbon, but did not lead the girl outside. Breaking an anchor was not the whole rescue.",
        "bell": "The bell remembers that you rang it. Its mark belongs to your account of this night.",
        "window": "You unbolted the window. I record the opening whether or not you chose to use it.",
    },
    "skeptic": {
        "debt": "You read the keeper's bargain. Whatever else we failed to understand, we knew the terms of replacement.",
        "exit_open": "You found an exit and opened it. A practical plan, until it became a question of who got to use it.",
        "exit_closed": "You found an exit, but left it bolted. A plan on paper was not an open way out.",
        "ribbon_escape": "You untied the ribbon, then left without guiding the girl out. Removing one obstacle did not solve the problem.",
        "bell": "You rang the bell. I cannot dismiss the mark it left as a trick of the light.",
        "window": "You unbolted the window. That part of your escape plan, at least, was under your control.",
    },
    "medium": {
        "debt": "You read the keeper's bargain. You knew how this house exchanged one loneliness for another.",
        "exit_open": "You found an exit, then opened it. I felt the night loosen its grip when the air came in.",
        "exit_closed": "You found an exit but left it bolted. The outside stayed close enough to imagine, too far to touch.",
        "ribbon_escape": "You untied the ribbon, then left her without a hand to guide her out. I feel hope still waiting at the threshold.",
        "bell": "You rang the bell. Its mark is a place inside you where the house learned to listen.",
        "window": "You unbolted the window. The living air you let inside remembers the warmth of your hands.",
    },
}

ENDING_CLOSE = {
    "archivist": {
        "liberation": "Your invitation is blank. For the record: the future is no longer a debt.",
        "escape": "At home, another invitation waits, dated tomorrow. I cannot close the record.",
        "inheritance": "You light the lamp. Beyond the gates a new invitation is being delivered. The archive has appointed its next custodian.",
    },
    "skeptic": {
        "liberation": "Your invitation is blank. 'We can go,' I say. For the first time tonight, I believe my own conclusion.",
        "escape": "At home, an invitation waits on your table. Tomorrow's date. I have run out of reasonable explanations.",
        "inheritance": "You light the lamp. Somewhere beyond the gates, a new invitation is being delivered. I try to warn its reader. My voice stays in the walls.",
    },
    "medium": {
        "liberation": "Your invitation is blank. 'Listen,' I whisper. No counting. Only the two of you, and a morning that belongs to neither keeper nor house.",
        "escape": "At home, an invitation waits, dated tomorrow. Before you touch it, I feel someone on the other side of the paper.",
        "inheritance": "You light the lamp. A new invitation travels beyond the gates. I feel the house reach for someone who has not learned to fear it yet.",
    },
}


def first_fact(m: Memory) -> str:
    return next(fact for fact in ("key", "name", "steps") if fact in m.facts)


def ending_narration(m: Memory) -> str:
    persona, ending = m.persona, m.scene
    route = "garden window" if "window" in m.facts else "front door"
    pieces = [ENDING_OPEN[persona][ending].format(route=route), FIRST_RECOLLECTION[persona][first_fact(m)]]
    if "trust" in m.facts:
        promise = ending
        if ending == "inheritance":
            promise += "_free" if "ribbon" in m.facts else "_bound"
        pieces.append(PROMISE_END[persona][promise])
    elif "debt" in m.facts:
        pieces.append(OTHER_END[persona]["debt"])
    else:
        pieces.append(OTHER_END[persona]["exit_open" if "window" in m.facts else "exit_closed"])
    if ending == "inheritance":
        if "window" in m.facts:
            pieces.append(OTHER_END[persona]["window"])
        pieces.append("The bell recognizes the hand that rang it." if "bell" in m.facts else
                      "The bell rings once without being touched.")
        pieces.append("Eleanor escapes through the door you can no longer cross." if "ribbon" in m.facts else
                      "The girl remains in the mirror. Now you are the keeper she must ask for freedom.")
    elif "bell" in m.facts:
        pieces.append(OTHER_END[persona]["bell"])
    elif "window" in m.facts:
        pieces.append(OTHER_END[persona]["window"])
    elif ending == "escape":
        pieces.append(OTHER_END[persona]["ribbon_escape"])
    if ending == "liberation":
        pieces.append("'Eleanor,' you say. She smiles at the name you recovered." if "name" in m.facts else
                      "She tells you her name at last: Eleanor.")
    pieces.append(ENDING_CLOSE[persona][ending])
    return " ".join(pieces)


def narrate(m: Memory) -> str:
    if m.scene == "threshold":
        return OPENING[m.persona]
    if m.scene == "gallery":
        return " ".join((DISCOVERY[m.persona][first_fact(m)], GALLERY[m.persona]))
    if m.scene == "belfry":
        relationship = next(fact for fact in ("trust", "debt", "exit") if fact in m.facts)
        return " ".join((ACCESS[m.persona][first_fact(m)], RELATIONSHIP[m.persona][relationship], BELFRY[m.persona]))
    if m.scene == "reckoning":
        action = next(fact for fact in ("ribbon", "bell", "window") if fact in m.facts)
        relationship = TRUST_AT_RECKONING if "trust" in m.facts else DISTANCE_AT_RECKONING
        return " ".join((CONSEQUENCE[m.persona][action], RECKONING[m.persona], relationship[m.persona]))
    return ending_narration(m)
