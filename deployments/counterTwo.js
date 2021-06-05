const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  num2bin,
  SigHashPreimage,
} = require("scryptlib");
const {
  DataLen,
  loadDesc,
  createUnlockingTx,
  createLockingTx,
  sendTx,
  showError,
} = require("../helper");
const { privateKey } = require("../privateKey");

const AMOUNT = 10000;
const FEE = AMOUNT / 10;

const incrementRecursively = async (counter, lockingTxid, amount, n, k) => {
  const prevLockingScript = counter.lockingScript.toASM();
  counter.setDataPart(num2bin(k + 1, DataLen) + num2bin(k + 1, DataLen));
  const newLockingScript = counter.lockingScript.toASM();
  const newAmount = amount - FEE;

  const unlockingTx = await createUnlockingTx(
    lockingTxid,
    amount,
    prevLockingScript,
    newAmount,
    newLockingScript
  );

  const preimage = getPreimage(unlockingTx, prevLockingScript, amount);
  const unlockingScript = counter
    .increment(new SigHashPreimage(toHex(preimage)), newAmount)
    .toScript();
  unlockingTx.inputs[0].setScript(unlockingScript);
  const newLockingTxid = await sendTx(unlockingTx);

  incrementRecursively(counter, newLockingTxid, newAmount, n - 1, k + 1);
};

const main = async () => {
  const Counter = buildContractClass(loadDesc("counterTwo_desc.json"));
  const counter = new Counter();
  // append state as op_return data
  counter.setDataPart(num2bin(0, DataLen) + num2bin(0, DataLen));
  const lockingTx = await createLockingTx(privateKey.toAddress(), AMOUNT);
  lockingTx.outputs[0].setScript(counter.lockingScript);
  lockingTx.sign(privateKey);
  const lockingTxid = await sendTx(lockingTx);
  console.log("funding txid:      ", lockingTxid);
  incrementRecursively(counter, lockingTxid, AMOUNT, 1, 0);
};

main();
