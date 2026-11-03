import { useId } from 'react';
import type { Session } from './contracts';

const palettes = {
  threshold: ['#121522', '#68648d', '#dec39a'], gallery: ['#181420', '#9681b0', '#c7badc'],
  belfry: ['#101929', '#899bb8', '#ddd9ec'], reckoning: ['#1c112b', '#a184d1', '#e2c9ff'],
  liberation: ['#342b35', '#d6ac85', '#ffe6b5'], escape: ['#0b1725', '#6f94af', '#c4e4ee'],
  inheritance: ['#180e28', '#7e5bac', '#d1b1f7'],
};

/** Original local artwork. Atmospheric symbols never add facts to story memory. */
export function SceneArt({ scene }: { scene: Session['scene']['id'] }) {
  const id = useId().replace(/:/g, '');
  const [dark, mid, light] = palettes[scene];
  const ending = ['liberation', 'escape', 'inheritance'].includes(scene);
  return <svg className="scene-illustration" viewBox="0 0 600 400" role="img" aria-label={`Blackthorn House: ${scene} atmosphere`} preserveAspectRatio="xMidYMid slice">
    <defs>
      <radialGradient id={`${id}-sky`} cx="65%" cy="25%" r="90%"><stop stopColor={mid}/><stop offset="1" stopColor={dark}/></radialGradient>
      <linearGradient id={`${id}-beam`} x2="0" y2="1"><stop stopColor={light} stopOpacity=".4"/><stop offset="1" stopColor={light} stopOpacity="0"/></linearGradient>
      <linearGradient id={`${id}-glass`} x2="1" y2="1"><stop stopColor={mid}/><stop offset=".5" stopColor={dark}/><stop offset="1" stopColor={light} stopOpacity=".35"/></linearGradient>
    </defs>
    <rect width="600" height="400" fill={`url(#${id}-sky)`}/>
    <g fill={light} opacity=".4">{[42, 113, 194, 361, 444, 530].map((x, i) => <circle key={x} cx={x} cy={28 + i % 3 * 24} r="1"/>)}</g>
    {(scene === 'threshold' || ending) && <>
      <circle cx="450" cy={scene === 'liberation' ? 190 : 80} r={scene === 'liberation' ? 88 : 44} fill={light} opacity=".72"/>
      {scene === 'liberation' && <path d="M350 170L150 400H600L500 170Z" fill={`url(#${id}-beam)`}/>}
      <path d="M78 340V190L146 128L210 190V148L300 60L388 148V190L456 128L522 190V340Z" fill={dark} stroke={mid} strokeWidth="3"/>
      <path d="M130 340V210H195V340M405 340V210H470V340M214 340V157H387V340" fill="none" stroke={mid} opacity=".55"/>
      <path d="M265 340V246Q300 192 335 246V340" fill={scene === 'liberation' ? light : '#090a13'} stroke={mid} strokeWidth="3"/>
      <path d="M285 170V140Q300 115 315 140V170Z" fill={light} opacity=".7"/>
      <path d="M300 129V170M284 151H316" stroke={dark} strokeWidth="3"/>
      <g fill={light} opacity={scene === 'inheritance' ? '.7' : '.18'}><path d="M145 233H175V272H145Z"/><path d="M424 233H454V272H424Z"/></g>
      <path d="M248 341L180 400M353 341L435 400M230 361H377M214 380H405" stroke={mid} fill="none" opacity=".6"/>
      {scene === 'threshold' && <g stroke="#090c15" strokeWidth="8" fill="none"><path d="M30 400L48 116M48 194L8 145M45 234L96 172M570 400L548 115M551 205L597 150M551 251L511 196"/></g>}
      {scene === 'escape' && <path d="M55 400Q140 260 187 213M55 400L25 212M25 275L0 244M25 310L73 263" stroke="#080d16" strokeWidth="13" fill="none"/>}
      {scene === 'inheritance' && <g stroke={light} fill="none" opacity=".35"><circle cx="300" cy="245" r="125"/><path d="M168 245H432M300 112V378M207 152L393 338M207 338L393 152"/></g>}
    </>}
    {scene === 'gallery' && <>
      <path d="M0 330H600M20 0V400M580 0V400" stroke={mid} opacity=".4"/>
      <g stroke={mid} strokeWidth="6"><path d="M70 70H255V298H70Z" fill={dark}/><path d="M85 85H240V283H85Z" fill={`url(#${id}-glass)`}/></g>
      <ellipse cx="162" cy="151" rx="28" ry="37" fill={mid} opacity=".6"/><path d="M112 265Q113 184 162 184Q211 184 215 265Z" fill={dark}/>
      <path d="M337 302V108Q430 -6 523 108V302Z" fill={`url(#${id}-glass)`} stroke={mid} strokeWidth="7"/>
      <path d="M352 291V114Q430 16 508 114V291Z" fill="none" stroke={light} opacity=".4"/>
      <path d="M419 123L450 168L425 205L466 273M425 205L389 231" stroke={light} opacity=".5" fill="none"/>
      <ellipse cx="425" cy="208" rx="24" ry="63" fill={light} opacity=".09"/>
      <path d="M0 400L300 330L600 400M162 330L110 400M430 330L500 400" stroke={mid} opacity=".3" fill="none"/>
    </>}
    {scene === 'belfry' && <>
      <circle cx="426" cy="90" r="54" fill={light} opacity=".8"/>
      <path d="M380 75L100 400H580L460 75Z" fill={`url(#${id}-beam)`}/>
      <path d="M50 400V90L300 -60L550 90V400H490V118L300 8L110 118V400Z" fill={dark} stroke={mid} strokeWidth="4"/>
      <path d="M300 38V127M162 135H438" stroke={mid} strokeWidth="9"/>
      <path d="M198 281Q235 250 236 185Q238 129 300 129Q362 129 364 185Q365 250 402 281Z" fill={dark} stroke={mid} strokeWidth="5"/>
      <ellipse cx="300" cy="281" rx="102" ry="15" fill={mid}/><circle cx="300" cy="288" r="14" fill={light}/>
      <path d="M315 145Q400 167 355 239Q312 307 389 358M315 145Q347 220 320 265Q288 310 330 358" stroke="#b989aa" strokeWidth="8" fill="none"/>
      <path d="M54 370H546M75 390H525" stroke={mid} opacity=".5"/>
    </>}
    {scene === 'reckoning' && <>
      <path d="M50 400L100 40H500L550 400M130 400L163 88H437L470 400" stroke={mid} fill="none" strokeWidth="5" opacity=".5"/>
      <path d="M225 365V140Q300 15 375 140V365Z" stroke={light} strokeWidth="3" fill={dark}/>
      <path d="M290 110L247 400H390L310 110Z" fill={`url(#${id}-beam)`}/>
      <g fill="none" stroke={light}><ellipse cx="300" cy="313" rx="175" ry="53" opacity=".35"/><ellipse cx="300" cy="313" rx="130" ry="35" opacity=".5"/><path d="M125 313L435 284L300 365L190 285L475 313" opacity=".35"/></g>
      <path d="M140 240Q90 178 135 145M457 260Q520 193 468 131M170 315Q214 268 191 210M410 320Q366 261 405 190" stroke={mid} strokeWidth="5" fill="none" opacity=".7"/>
    </>}
    <path d="M0 360Q130 325 300 366T600 348V400H0Z" fill={mid} opacity=".1"/>
    <path d="M0 385Q140 350 310 380T600 371" fill="none" stroke={light} opacity=".15"/>
  </svg>;
}
