async function test() {
  try {
    await Promise.reject("fail");
  } catch (e) {
    console.log("Caught:", e);
  }
}
test();
console.log("Done");
