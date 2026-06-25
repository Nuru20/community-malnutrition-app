let MODEL = null;
let FEATURES = null;
let THRESHOLD = 0.491;

// load model from JSON file
async function loadModel() {
  const resp = await fetch('/models/vht_model.json');
  const data = await resp.json();
  MODEL     = data.trees;
  FEATURES  = data.features;
  THRESHOLD = data.threshold;
  console.log(`Model loaded: ${MODEL.length} trees`);
}

// traverse a single tree for one sample
function traverseTree(tree, sample) {
  if (tree.leaf !== undefined) {
    return tree.leaf;
  }

  const featureIndex = parseInt(tree.split.replace('f', ''));
  const featureName  = FEATURES[featureIndex];
  const value        = sample[featureName] || 0;

  if (value < tree.split_condition) {
    return traverseTree(tree.children[0], sample);
  } else {
    return traverseTree(tree.children[1], sample);
  }
}

// predict probability for one sample
function predictProba(sample) {
  if (!MODEL) return null;

  // sum all tree outputs
  let score = 0;
  MODEL.forEach(tree => {
    score += traverseTree(tree, sample);
  });

  // convert to probability using sigmoid
  const prob = 1 / (1 + Math.exp(-score));
  return prob;
}

// MUAC override — clinical safety net
function applyMUACOverride(probability, muac) {
  if (muac < 115) {
    return { probability: 0.95, override: 'severe' };
  }
  if (muac < 125) {
    // force at least MODERATE
    return {
      probability: Math.max(probability, THRESHOLD + 0.05),
      override: 'borderline'
    };
  }
  return { probability, override: null };
}

// main prediction function
function predict(vhtInputs) {
  // fill all 43 variables
  const fullSample = fillDefaults(vhtInputs);

  // get model probability
  let prob = predictProba(fullSample);

  // apply MUAC safety override
  const { probability, override } = applyMUACOverride(
    prob, vhtInputs.muac
  );

  // determine risk level
  let risk, color, emoji;
  if (probability >= 0.65) {
    risk = 'HIGH';     color = '#dc2626'; emoji = '🔴';
  } else if (probability >= THRESHOLD) {
    risk = 'MODERATE'; color = '#f59e0b'; emoji = '🟡';
  } else {
    risk = 'LOW';      color = '#16a34a'; emoji = '🟢';
  }

  // generate plain language reasons
  const reasons = generateReasons(fullSample, vhtInputs, override);

  // generate mother advice
  const advice = generateAdvice(risk, vhtInputs);

  // generate action
  const action = generateAction(risk);

  return { probability, risk, color, emoji, reasons, advice, action, override };
}

function generateReasons(full, vht, override) {
  const reasons = [];

  if (override === 'severe') {
    reasons.push('MUAC is very low — child is severely malnourished');
    return reasons;
  }

  if (override === 'borderline') {
    reasons.push('MUAC is borderline low — needs close monitoring');
  }

  if (vht.age_months >= 12 && vht.age_months <= 35) {
    reasons.push(`Age ${vht.age_months} months — this is the most important growth period`);
  }

  if (!vht.mother_reads) {
    reasons.push('Mother cannot read — harder to get nutrition information');
  }

  if (vht.far_from_clinic) {
    reasons.push('Far from health centre — harder to get medical help');
  }

  if (vht.children_u5 >= 3) {
    reasons.push(`${vht.children_u5} young children at home — food and care is shared`);
  }

  if (vht.sex === 1 && vht.age_months >= 12 && vht.age_months <= 35) {
    reasons.push('Boys in this age group are at higher risk');
  }

  if (vht.muac < 125) {
    reasons.push(`MUAC of ${vht.muac}mm is below the healthy range (125mm+)`);
  }

  return reasons.slice(0, 3); // show max 3 reasons
}

function generateAdvice(risk, vht) {
  if (risk === 'HIGH') {
    return 'Take this child to the health centre within 3 days. Tell the nurse you are worried about the child\'s growth.';
  }
  if (risk === 'MODERATE') {
    return 'Feed this child eggs, beans, fish, and vegetables every day. Come back to check in 2 weeks.';
  }
  return 'Keep feeding the child well with different foods every day. Come back to check in 3 months.';
}

function generateAction(risk) {
  if (risk === 'HIGH') return {
    text: '⚠️  REFER TO HEALTH CENTRE THIS WEEK',
    bg: '#fee2e2', border: '#dc2626', color: '#dc2626'
  };
  if (risk === 'MODERATE') return {
    text: '📅  VISIT AGAIN IN 2 WEEKS',
    bg: '#fef3c7', border: '#f59e0b', color: '#92400e'
  };
  return {
    text: '✓  CONTINUE MONITORING — 3 MONTHS',
    bg: '#dcfce7', border: '#16a34a', color: '#166534'
  };
}