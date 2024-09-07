/**
 * @IMPORANT
 * 1. Only Non-Function-Components receive super ($) as a parameter to their script function;
 * 2. Hooks are only available in Function-Components, and prevent super ($) Usage
 */

const NonFunctionComponent = (
  <h1 onClick={$.call(function () {})}>count: {$.use("txt")}</h1>
);

function functionComponent(props) {
  let [count, setCount, countChanged] = useWatcher(0);
  // setCount (does not) automatically update the state

  const incremenet = () => count++;

  useEffect(function () {}, [countChanged]); // before first Paint and Applying Updates
  useLayoutEffect(function () {}, [countChanged]); // after first Paint and Applying Updates

  return (
    <Frag>
      <NonFunctionComponent txt={count()} />
      <button onClick={useSignal(incremenet)}>{props["propName"]}</button>
    </Frag>
  );
}
