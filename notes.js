/**
 * @IMPORANT
 * 1. Only Non-Function-Components receive super ($) as a parameter to their script function;
 * 2. Hooks are only available in Function-Components, and prevent super ($) Usage
 */

function handleClick() {
  // CODE
  // return true to update UI DOM-Component
  return true;
}

let txt = 0;

const JSXComponent = <h1 onClick={handleClick}>count: {txt}</h1>;

function functionComponent(props) {
  let count = 0;

  const incremenet = () => count++ || true;

  useWatcher(function (track, call) {
    // false => before first Paint and Applying Updates
    // true => after first Paint and Applying Updates
    track([count]) && call(false, logCount);
  });

  function logCount() {
    console.log(count);
  }

  setInterval(useForce(incremenet), 1000);

  return (
    <Frag>
      <NonFunctionComponent txt={count()} />
      <button onClick={incremenet}>{use("propName")}</button>
    </Frag>
  );
}
