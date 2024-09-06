const complicatedArray = [1, 2, [3, 4], 5];

function one(arr) {
  let index = 0;
  while (index < arr.length) {
    const item = arr[index++];
    if (Array.isArray(item)) one(item);
    else console.log(item);
  }
}

function two(arr) {
  (function reCall(index) {
    const item = arr[index++];
    if (Array.isArray(item)) one(item);
    else console.log(item);
    index < arr.length && reCall(index + 1);
  })(0);
}
