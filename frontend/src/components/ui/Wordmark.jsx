import './ui.css';

/**
 * The "Polymono" wordmark, set in Antonio (it replaces the raster logo in its white box). The board's centre
 * art still carries the puzzle-shield logo.
 *
 *   <Wordmark />                                        top bar, phone (22px)
 *   <Wordmark size="md" sub="Manhattan edition, day 9" inline />   desktop top bar: hairline, then the sub line
 *   <Wordmark as="h1" size="xl" sub="Manhattan edition" />         login
 *
 * size  'sm' 22 | 'md' 26 | 'lg' 36 | 'xl' 60
 * sub   optional second line: brass under an xl wordmark, slate beside a hairline when `inline`
 */
export default function Wordmark({ as: Tag = 'span', size = 'sm', sub, inline = false, className = '' }) {
  const Outer = Tag === 'span' ? 'span' : 'div'; // a heading needs a block parent
  return (
    <Outer className={`ui-wordmark ui-wordmark--${size}${inline ? ' ui-wordmark--inline' : ''}${className ? ` ${className}` : ''}`}>
      <Tag className="ui-wordmark__name">Polymono</Tag>
      {sub && <span className="ui-wordmark__sub"><span>{sub}</span></span>}
    </Outer>
  );
}
