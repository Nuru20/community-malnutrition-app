// ── SUPABASE CONNECTION ───────────────────
// ── SUPABASE ──────────────────────────────
let db = null;
try {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) {
  console.log('Supabase not configured');
}



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

  lastPrediction = result;
  lastInputs = inputs;

  // show referral question
  document.getElementById('referralSection').style.display = 'block';
}

// reset for next child
function resetForm() {
  document.getElementById('age').value      = '';
  document.getElementById('muac').value     = '';
  document.getElementById('district').value = '';
  document.getElementById('vhtcode').value  = '';

  state.sex = state.reads = state.dist = state.children = state.referral = null;

  document.querySelectorAll('.toggle-btn, .count-btn')
    .forEach(b => b.classList.remove('active'));

  document.getElementById('formScreen').style.display   = 'block';
  document.getElementById('resultScreen').style.display = 'none';
  document.getElementById('referralSection').style.display = 'none';

  lastPrediction = null;
  lastInputs = null;

  window.scrollTo(0, 0);
}

// ── SAVE SCREENING TO DATABASE ────────────
async function saveScreening() {
  if (!lastPrediction || !lastInputs) return;

  const record = {
    district:        document.getElementById('district').value || 'Unknown',
    village:         '',
    vht_code:        document.getElementById('vhtcode').value || 'Anonymous',
    age_months:      lastInputs.age_months,
    sex:             lastInputs.sex,
    muac_mm:         lastInputs.muac,
    mother_reads:    lastInputs.mother_reads === 1,
    children_u5:     lastInputs.children_u5,
    far_from_clinic: lastInputs.far_from_clinic === 1,
    risk_level:      lastPrediction.risk,
    risk_probability: lastPrediction.probability,
    muac_override:   lastPrediction.override || 'none',
    referral_made:   state.referral === true,
    app_version:     'vht-v1',
  };

  try {
    const { error } = await db.from('screenings').insert(record);
    if (error) throw error;

    // show success message
    alert('✓ Screening saved successfully');

    // reset for next child
    resetForm();

  } catch (err) {
    console.error('Save failed:', err);

    // save locally if offline
    saveLocally(record);
    alert('Saved locally — will sync when online');
    resetForm();
  }
}

// ── LOCAL STORAGE BACKUP (offline) ────────
function saveLocally(record) {
  const pending = JSON.parse(
    localStorage.getItem('pending_screenings') || '[]'
  );
  pending.push({ ...record, saved_at: new Date().toISOString() });
  localStorage.setItem('pending_screenings', JSON.stringify(pending));
  console.log(`Saved locally. Pending: ${pending.length}`);
}

// sync pending records when back online
async function syncPending() {
  const pending = JSON.parse(
    localStorage.getItem('pending_screenings') || '[]'
  );
  if (pending.length === 0) return;

  console.log(`Syncing ${pending.length} pending screenings...`);

  for (const record of pending) {
    try {
      const { error } = await db.from('screenings').insert(record);
      if (!error) {
        // remove from pending
        const remaining = JSON.parse(
          localStorage.getItem('pending_screenings') || '[]'
        ).filter(r => r.saved_at !== record.saved_at);
        localStorage.setItem('pending_screenings',
          JSON.stringify(remaining));
      }
    } catch (e) {
      console.log('Sync failed for record:', e);
    }
  }
  console.log('Sync complete');
}

// auto sync when internet returns
window.addEventListener('online', syncPending);