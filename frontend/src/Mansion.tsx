export function Mansion() {
  return <svg className="mansion" viewBox="0 0 1000 670" role="img" aria-label="Original illustration of Blackthorn House beneath an indigo moon">
    <defs>
      <radialGradient id="sky"><stop stopColor="#373071"/><stop offset="1" stopColor="#0c0d18"/></radialGradient>
      <linearGradient id="fog" x2="0" y2="1"><stop stopColor="#252544" stopOpacity="0"/><stop offset="1" stopColor="#0b0c14"/></linearGradient>
      <linearGradient id="stone" x2="0" y2="1"><stop stopColor="#272739"/><stop offset="1" stopColor="#11131f"/></linearGradient>
      <linearGradient id="light" x2="0" y2="1"><stop stopColor="#e8b27a"/><stop offset="1" stopColor="#845e63"/></linearGradient>
      <pattern id="rain" width="67" height="110" patternUnits="userSpaceOnUse"><path d="M30 12l-6 20M60 70l-3 10" stroke="#a4a2cc" strokeOpacity=".12"/></pattern>
    </defs>
    <rect width="1000" height="670" fill="url(#sky)"/>
    <circle cx="700" cy="165" r="81" fill="#c4bfd6" opacity=".7"/><circle cx="677" cy="143" r="79" fill="#a6a1bc" opacity=".2"/>
    <path d="M0 275Q170 230 320 276T640 256T1000 276V320H0Z" fill="#77718f" opacity=".08"/>
    <path d="M100 550l65-80 72 29 65-74 70 40 97-52 78 49 72-38 72 51 84-41 125 115z" fill="#10121c"/>
    <g fill="url(#stone)" stroke="#484356" strokeWidth="2"><path d="M272 503V316l77-46 73 48v185z"/><path d="M402 526V261h218v265z"/><path d="M607 514V316l73-46 78 48v196z"/><path d="M440 266V190l70-62 71 62v76z"/></g>
    <g fill="#10111c" stroke="#4e465c" strokeWidth="2"><path d="M250 323l96-98 94 98-90-23z"/><path d="M589 323l91-98 96 98-96-23z"/><path d="M418 200l92-105 93 105-92-27z"/><path d="M392 270l119-70 120 70z"/></g>
    <path d="M510 105V73m-7 12h14M349 228v-26m330 26v-26" stroke="#81728f" strokeWidth="3"/>
    <g fill="#0a0c17" stroke="#53465c" strokeWidth="3"><path d="M319 375v-34q28-32 56 0v34zM650 375v-34q28-32 56 0v34z"/><path d="M319 460v-34q28-32 56 0v34zM650 460v-34q28-32 56 0v34z"/><path d="M445 359v-34q20-28 40 0v34zM539 359v-34q20-28 40 0v34z"/><path d="M480 527v-88q30-48 61 0v88z"/></g>
    <path d="M492 253v-32q19-28 38 0v32z" fill="url(#light)"/><path d="M511 210v43m-19-19h38" stroke="#3c3041" strokeWidth="4"/>
    <path d="M500 520v-70q11-25 22 0v70z" fill="url(#light)" opacity=".65"/><path d="M425 529h173m-185 12h198m-212 12h225" stroke="#544855" strokeWidth="5"/>
    <path d="M485 550Q425 590 376 670h294q-91-84-132-120" fill="#393245" opacity=".5"/>
    <g stroke="#0a0c15" fill="none" strokeLinecap="round"><path d="M118 610q53-180 25-342m3 124L60 310m84 44 74-118m-76 62-57-108m61 224 90-61M887 620q-43-172-22-370m-4 109 78-109m-78 79-65-105m64 202 94-78" strokeWidth="16"/><path d="M61 310l-8-61m34 38-57-18m188-33 4-70m-26 103 61-24m-172-55 9-60m845 120 35-11m-58 47 8-66m-128 4-3-55m22 86-61-13" strokeWidth="6"/></g>
    <rect width="1000" height="670" fill="url(#rain)"/><rect y="460" width="1000" height="210" fill="url(#fog)"/>
    <path d="M60 585Q300 515 540 570T1000 561" stroke="#9690b4" strokeWidth="20" fill="none" opacity=".04"/>
    <g fill="#938ca9" opacity=".7"><circle cx="244" cy="143" r="1"/><circle cx="360" cy="94" r="1"/><circle cx="811" cy="93" r="1"/><circle cx="597" cy="74" r="1"/></g>
  </svg>;
}
