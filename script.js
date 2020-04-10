class SeadRNG {
  // Unvalidated JavaScript port of Nintendo's Sead RNG

  constructor() {
    this.ctx = new Uint32Array(4);

    switch (arguments.length) {
    case 1:
      const seed = arguments[0];
      this.ctx[0] = 0x6C078965 * (seed ^ (seed >>> 30)) + 1;
      this.ctx[1] = 0x6C078965 * (this.ctx[0] ^ (this.ctx[0] >>> 30)) + 2;
      this.ctx[2] = 0x6C078965 * (this.ctx[1] ^ (this.ctx[1] >>> 30)) + 3;
      this.ctx[3] = 0x6C078965 * (this.ctx[2] ^ (this.ctx[2] >>> 30)) + 4;
      break;
    case 4:
      arguments.forEach((n, i) => { this.ctx[i] = n; })
      if (this.ctx.every(x => x === 0)) {
        // seeds must not be all zero.
        this.ctx[0] = 1;
        this.ctx[1] = 0x6C078967;
        this.ctx[2] = 0x714ACB41;
        this.ctx[3] = 0x48077044;
      }
      break;
    default:
      throw ("Invalid argument for SeadRNG");
    }
  }

  getU32() {
    let n = new Uint32Array(1); // trim to uint32
    n[0] = this.ctx[0] ^ (this.ctx[0] << 11);

    this.ctx[0] = this.ctx[1];
    this.ctx[1] = this.ctx[2];
    this.ctx[2] = this.ctx[3];
    this.ctx[3] = n[0] ^ (n[0] >>> 8) ^ this.ctx[3] ^ (this.ctx[3] >>> 19);

    return this.ctx[3];
  }

  getBool() { return (this.getU32() & 0x80000000) !== 0; }

  getIntRange(min, max) {
    return Math.floor((this.getU32() * (max - min + 1)) / Math.pow(2, 32)) +
           min;
  }

  getFloatRange(min, max) {
    const val = 0x3F800000 | (this.getU32() >>> 9);
    let bval = new Uint32Array(1);
    bval[0] = val;
    let fval = new Float32Array(bval.buffer);
    return min + ((fval[0] - 1.0) * (max - min));
  }
}

const PATTERN_PROBABILITIES = {
  // first purchase at home island
  "-2" : [ 0, 0, 0, 1 ],

  // result from dot product of the matrix multiple times
  "-1" : [ 0.3014956, 0.24273934, 0.23843331, 0.21733175 ],

  "0" : [ 0.2, 0.3, 0.15, 0.35 ],
  "1" : [ 0.5, 0.05, 0.20, 0.25 ],
  "2" : [ 0.25, 0.45, 0.05, 0.25 ],
  "3" : [ 0.45, 0.25, 0.15, 0.15 ]
};

function choosePattern(prob) {
  const chance = Math.random();
  let acc = 0;
  for (let i = 0; i < prob.length; i++) {
    const v = prob[i];
    acc += v;
    if (chance < acc) {
      return i;
    }
  }
  return prob.length - 1; // failsafe
}

function getTurnipPrices(pattern, seed, filterPrices) {
  const rng = new SeadRNG(seed);
  let sellPrices = [];

  let basePrice = rng.getIntRange(90, 110);
  if (filterPrices[0] !== 0) {
    basePrice = filterPrices[0];
  }
  rng.getIntRange(0, 99); // pull one of the values from RNG for pattern check.

  for (let i = 2; i < 14; i++)
    sellPrices[i] = 0;
  sellPrices[0] = basePrice;
  sellPrices[1] = basePrice;

  let work;
  let decPhaseLen1, decPhaseLen2, peakStart;
  let hiPhaseLen1, hiPhaseLen2and3, hiPhaseLen3;
  let rate;

  switch (pattern) {
  case 0:
    // PATTERN 0: high, decreasing, high, decreasing, high
    work = 2;
    decPhaseLen1 = rng.getBool() ? 3 : 2;
    decPhaseLen2 = 5 - decPhaseLen1;

    hiPhaseLen1 = rng.getIntRange(0, 6);
    hiPhaseLen2and3 = 7 - hiPhaseLen1;
    hiPhaseLen3 = rng.getIntRange(0, hiPhaseLen2and3 - 1);

    // high phase 1
    for (let i = 0; i < hiPhaseLen1; i++) {
      sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    }

    // decreasing phase 1
    rate = rng.getFloatRange(0.8, 0.6);
    for (let i = 0; i < decPhaseLen1; i++) {
      sellPrices[work++] = Math.ceil(rate * basePrice);
      rate -= 0.04;
      rate -= rng.getFloatRange(0, 0.06);
    }

    // high phase 2
    for (let i = 0; i < (hiPhaseLen2and3 - hiPhaseLen3); i++) {
      sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    }

    // decreasing phase 2
    rate = rng.getFloatRange(0.8, 0.6);
    for (let i = 0; i < decPhaseLen2; i++) {
      sellPrices[work++] = Math.ceil(rate * basePrice);
      rate -= 0.04;
      rate -= rng.getFloatRange(0, 0.06);
    }

    // high phase 3
    for (let i = 0; i < hiPhaseLen3; i++) {
      sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    }
    break;
  case 1:
    // PATTERN 1: decreasing middle, high spike, random low
    peakStart = rng.getIntRange(3, 9);
    rate = rng.getFloatRange(0.9, 0.85);
    for (work = 2; work < peakStart; work++) {
      sellPrices[work] = Math.ceil(rate * basePrice);
      rate -= 0.03;
      rate -= rng.getFloatRange(0, 0.02);
    }
    sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    sellPrices[work++] = Math.ceil(rng.getFloatRange(1.4, 2.0) * basePrice);
    sellPrices[work++] = Math.ceil(rng.getFloatRange(2.0, 6.0) * basePrice);
    sellPrices[work++] = Math.ceil(rng.getFloatRange(1.4, 2.0) * basePrice);
    sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    for (; work < 14; work++) {
      sellPrices[work] = Math.ceil(rng.getFloatRange(0.4, 0.9) * basePrice);
    }
    break;
  case 2:
    // PATTERN 2: consistently decreasing
    rate = 0.9;
    rate -= rng.getFloatRange(0, 0.05);
    for (work = 2; work < 14; work++) {
      sellPrices[work] = Math.ceil(rate * basePrice);
      rate -= 0.03;
      rate -= rng.getFloatRange(0, 0.02);
    }
    break;
  case 3:
    // PATTERN 3: decreasing, spike, decreasing
    peakStart = rng.getIntRange(2, 9);

    // decreasing phase before the peak
    rate = rng.getFloatRange(0.9, 0.4);
    for (work = 2; work < peakStart; work++) {
      sellPrices[work] = Math.ceil(rate * basePrice);
      rate -= 0.03;
      rate -= rng.getFloatRange(0, 0.02);
    }

    sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    sellPrices[work++] = Math.ceil(rng.getFloatRange(0.9, 1.4) * basePrice);
    rate = rng.getFloatRange(1.4, 2.0);
    sellPrices[work++] =
        Math.ceil(rng.getFloatRange(1.4, rate) * basePrice) - 1;
    sellPrices[work++] = Math.ceil(rate * basePrice);
    sellPrices[work++] =
        Math.ceil(rng.getFloatRange(1.4, rate) * basePrice) - 1;

    // decreasing phase after the peak
    if (work < 14) {
      rate = rng.getFloatRange(0.9, 0.4);
      for (; work < 14; work++) {
        sellPrices[work] = Math.ceil(rate * basePrice);
        rate -= 0.03;
        rate -= rng.getFloatRange(0, 0.02);
      }
    }
    break;
  }

  return {
    pattern : pattern,
    prices : sellPrices,
    highest : Math.max(...sellPrices.slice(2))
  };
}

function run(lastweekPattern, filterPrices, simulations) {
  const patternProb = PATTERN_PROBABILITIES[lastweekPattern];
  const seed = Math.floor(Math.random() * 10000);

  let count = 0;

  // let possiblePrices = [];

  let possiblePatterns = [ 0, 0, 0, 0 ];

  let highestStats = [];
  let statsLabel = [];

  for (let i = 0; i < 700; i += 25) {
    highestStats.push(0);
    statsLabel.push(i);
  }

  simulation: for (let i = 0; i < simulations; i++) {
    const pattern = choosePattern(patternProb);
    const result = getTurnipPrices(pattern, seed + i, filterPrices);

    for (let j = 0; j < 14; j++) {
      if (filterPrices[j] !== 0 && result.prices[j] !== filterPrices[j]) {
        continue simulation;
      }
    }

    count++;
    // possiblePrices.push(result.prices);
    possiblePatterns[result.pattern]++;
    highestStats[Math.floor(result.highest / 25)]++;
  }

  const result = {
    // prices: possiblePrices,
    highestStats : highestStats,
    statsLabel : statsLabel,
    possiblePatterns : possiblePatterns,
    samples : count,
  }

  return result;
}

function onSubmit(event) {
  // TODO: take one line input first
  const sims = parseInt(document.getElementById('simulations').value, 10)

  let bp = parseInt(document.getElementById('buy').value, 10);

  if (Number.isNaN(bp)) {
    bp = 0;
  }

  let prices = [ bp, bp ];

  for (let i = 2; i < 14; i++) {
    let sp = parseInt(document.getElementById('sell_' + i).value, 10)
    if (Number.isNaN(sp)) {
      sp = 0;
    }
    prices.push(sp);
  }

  let oneliner = "";
  if (bp !== 0) {
    oneliner += bp + " ";
  }
  let lmt = 0;
  for (let i = 13; i >= 2; i--) {
    if (prices[i] !== 0) {
      lmt = i;
      break
    }
  }
  for (let i = 2; i <= lmt; i++) {
    oneliner += prices[i];
    oneliner += i % 2 === 0 ? "/" : " ";
  }

  document.getElementById('oneline').value = oneliner;

  let lwp = "-1";
  document.getElementsByName('lastweek_pattern').forEach(elem => {
    if (elem.checked) {
      lwp = elem.value;
    }
  })

  if (lwp === "-2") {
    // the base price is re-randomized in first purchase.
    prices[0] = 0;
    prices[1] = 0;
  }

  const result = run(lwp, prices, sims);

  const result_samples = document.getElementById("result_samples");
  const result_prob = document.getElementById("result_prob");

  result_samples.innerHTML = "";
  result_prob.innerHTML = "";
  result.possiblePatterns.forEach(p => {
    let elem = document.createElement("td")
    elem.append(p);
    result_samples.append(elem);
    let prob = document.createElement("td")
    prob.append(((p / result.samples) * 100).toFixed(2) + "%");
    result_prob.append(prob);
  });

  const result_price_labels = document.getElementById("result_price_labels");
  const result_price = document.getElementById("result_price");
  const result_price_prob = document.getElementById("result_price_prob");

  result_price_labels.innerHTML = "";
  result_price.innerHTML = "";
  result_price_prob.innerHTML = "";
  result.statsLabel.forEach(p => {
    let elem = document.createElement("th")
    elem.append(p + "-" + (p + 24));
    result_price_labels.append(elem);
  });
  result.highestStats.forEach(p => {
    let elem = document.createElement("td")
    elem.append(p);
    result_price.append(elem);
    let prob = document.createElement("td")
    prob.append(((p / result.samples) * 100).toFixed(2) + "%");
    result_price_prob.append(prob);
  });

  event.preventDefault();
}

const form = document.getElementById('form');
form.addEventListener('submit', onSubmit);
