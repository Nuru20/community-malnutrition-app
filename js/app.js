// state
const state = {
  sex:     null,
  reads:   null,
  dist:    null,
  children: null,
};

// load model when page opens
window.addEventListener('load', async () => {
  await loadModel();
  console.log('App ready');

  // register service worker for offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  // offline/online detection
  window.addEventListener('offline', () => document.body.classList.add('offline'));
  window.addEventListener('online',  () => document.body.classList.remove('offline'));
  if (!navigator.onLine) document.body.classList.add('offline');
});

// toggle button selection
function selectToggle(key, val, activeId, inactiveId) {
  state[key] = val;
  document.getElementById(activeId).classList.add('active');
  document.getElementById(inactiveId).classList.remove('active');
}

// count button selection
function selectCount(val) {
  state.children = val;
  document.querySelectorAll('.count-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i + 1 === val);
  });
}

// validate inputs
function validate() {
  const age  = parseInt(document.getElementById('age').value);
  const muac = parseInt(document.getElementById('muac').value);

  if (!age || age < 0 || age > 59) {
    alert('Please enter the child\'s age in months (0-59)');
    return false;
  }
  if (!muac || muac < 80 || muac > 250) {
    alert('Please enter the MUAC measurement in mm');
    return false;
  }
  if (state.sex === null) {
    alert('Please select Boy or Girl');
    return false;
  }
  if (state.reads === null) {
    alert('Please answer whether the mother can read');
    return false;
  }
  if (state.children === null) {
    alert('Please select number of children under 5 at home');
    return false;
  }
  if (state.dist === null) {
    alert('Please select distance to health centre');
    return false;
  }
  return true;
}

// run prediction
function runPrediction() {
  if (!validate()) return;

  const vhtInputs = {
    age_months:      parseInt(document.getElementById('age').value),
    sex:             state.sex,
    muac:            parseInt(document.getElementById('muac').value),
    mother_reads:    state.reads,
    children_u5:     state.children,
    far_from_clinic: state.dist,
  };

  const result = predict(vhtInputs);
  showResult(result, vhtInputs);
}

// show result screen
function showResult(result, inputs) {
  // hide form, show result
  document.getElementById('formScreen').style.display   = 'none';
  document.getElementById('resultScreen').style.display = 'block';
  window.scrollTo(0, 0);

  // risk badge
  const badge = document.getElementById('riskBadge');
  badge.style.background = result.risk === 'HIGH'   ? '#fee2e2' :
                           result.risk === 'MODERATE'? '#fef3c7' : '#dcfce7';
  document.getElementById('riskEmoji').textContent = result.emoji;
  document.getElementById('riskLabel').textContent = result.risk + ' RISK';
  document.getElementById('riskLabel').style.color = result.color;
  document.getElementById('riskSub').textContent =
    result.risk === 'HIGH'     ? 'This child needs help now' :
    result.risk === 'MODERATE' ? 'This child needs watching' :
                                 'This child is growing well';

  // reasons
  const reasonsList = document.getElementById('reasonsList');
  reasonsList.innerHTML = '';
  result.reasons.forEach(reason => {
    reasonsList.innerHTML += `
      <div class="reason-item">
        <div class="reason-dot"></div>
        <span>${reason}</span>
      </div>`;
  });

  // action box
  const actionBox = document.getElementById('actionBox');
  actionBox.style.background   = result.action.bg;
  actionBox.style.borderColor  = result.action.border;
  actionBox.style.color        = result.action.color;
  document.getElementById('actionText').textContent = result.action.text;

  // advice
  document.getElementById('adviceText').textContent = result.advice;
}

// reset for next child
function resetForm() {
  // clear inputs
  document.getElementById('age').value  = '';
  document.getElementById('muac').value = '';

  // clear state
  state.sex = state.reads = state.dist = state.children = null;

  // clear button styles
  document.querySelectorAll('.toggle-btn, .count-btn')
    .forEach(btn => btn.classList.remove('active'));

  // show form, hide result
  document.getElementById('formScreen').style.display   = 'block';
  document.getElementById('resultScreen').style.display = 'none';
  window.scrollTo(0, 0);
}