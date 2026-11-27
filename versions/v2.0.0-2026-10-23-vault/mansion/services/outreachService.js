// Automated Outreach System (Premium)
// Generates communication templates for property outreach.

const TEMPLATES = {
  DIRECT_PURCHASE: (owner) => `Dear ${owner}, I am writing regarding your property. We are interested in potential acquisition opportunities.`,
  PROBATE: (owner) => `Dear ${owner}, I am reaching out regarding a matter involving the estate of the listed owner.`
};

async function generateOutreach(ownerName, type) {
  console.log(`Generating outreach for: ${ownerName}`);
  
  const template = TEMPLATES[type] || TEMPLATES.DIRECT_PURCHASE;
  return template(ownerName);
}

module.exports = { generateOutreach };
