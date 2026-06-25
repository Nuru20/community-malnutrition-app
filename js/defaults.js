// Conservative defaults for variables VHT cannot collect
// These are based on your Uganda DHS 2016 dataset
// Using rural/poor/worst-case defaults for safety

const DEFAULTS = {
  // child
  birth_order:            2,     // median
  size_at_birth:          3,     // average
  birth_weight:           3.2,   // dataset mean
  birth_interval_clean:   30,    // dataset median
  birth_interval_missing: 0,
  short_interval:         0,

  // maternal
  mother_age:             26,    // dataset mean
  teenage_mother:         0,
  mother_age_first_birth: 19,

  // household
  wealth_index:           2,     // poorer — conservative
  urban_rural:            2,     // rural — 83% of sample
  region:                 3,     // Northern — highest risk
  household_size:         5,     // dataset mean

  // healthcare access
  permission_barrier:     1,     // problem — conservative
  money_barrier:          1,     // problem — conservative
  access_barrier_score:   2,

  // feeding
  breastfeeding:          1,     // most common < 24 months
  dietary_diversity:      3,     // dataset mean

  // wash
  improved_water:         0,     // no — conservative
  improved_sanitation:    0,     // no — conservative

  // birth care
  antenatal_category:     1,     // below WHO — conservative
  adequate_antenatal:     0,
  is_most_recent_birth:   1,
  caesarean:              0,
};

function fillDefaults(vhtInputs) {
  // start with defaults
  const full = { ...DEFAULTS };

  // override with VHT inputs
  full.age_months      = vhtInputs.age_months;
  full.sex             = vhtInputs.sex;
  full.mother_education = vhtInputs.mother_reads ? 1 : 0;
  full.children_u5_hh  = vhtInputs.children_u5;
  full.distance_barrier = vhtInputs.far_from_clinic ? 1 : 0;

  // derive household size from children
  full.household_size = Math.max(4, vhtInputs.children_u5 * 2 + 2);

  // update composite score with real distance barrier
  full.access_barrier_score = 1 + 1 + full.distance_barrier;

  // compute all interaction features
  full.age_x_sex        = full.age_months * full.sex;
  full.age_x_wealth     = full.age_months * full.wealth_index;
  full.age_x_education  = full.age_months * full.mother_education;
  full.age_x_rural      = full.age_months * full.urban_rural;
  full.age_squared      = full.age_months ** 2;
  full.age_cubed        = full.age_months ** 3;
  full.edu_x_wealth     = full.mother_education * full.wealth_index;
  full.poor_rural       = (full.wealth_index <= 2 && full.urban_rural === 2) ? 1 : 0;
  full.interval_x_order = full.birth_interval_clean * full.birth_order;
  full.small_x_order    = full.size_at_birth * full.birth_order;
  full.low_bw_flag      = full.birth_weight < 2.5 ? 1 : 0;
  full.teen_x_order     = full.teenage_mother * full.birth_order;
  full.teen_x_noedu     = full.teenage_mother * (full.mother_education === 0 ? 1 : 0);
  full.multi_barrier    = full.permission_barrier + full.money_barrier + full.distance_barrier;

  return full;
}