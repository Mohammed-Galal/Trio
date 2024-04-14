export default function (patch, useContext) {
  // we use on(dis|Mount) instead of useEffect
  const someEv = patch(function () {}); // to update Component State

  const [data, setData] = useContext("someData");

  return (
    <F>
      <h1>hello {use("txt")}</h1>
    </F>
  );
}
