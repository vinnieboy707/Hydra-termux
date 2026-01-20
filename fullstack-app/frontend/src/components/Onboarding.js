import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css';

const Onboarding = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has completed onboarding
    const onboardingComplete = localStorage.getItem('onboarding_complete');
    if (!onboardingComplete) {
      setShowOnboarding(true);
    }
  }, []);

  const steps = [
    {
      title: '🎉 Welcome to Hydra-Termux',
      content: (
        <div className="onboarding-step">
          <h2>🤖 AI-Powered Penetration Testing Platform</h2>
          <p className="welcome-text">
            Welcome! I'm your AI assistant, and I'll guide you through everything you need to know.
          </p>
          <div className="feature-grid">
            <div className="feature-card">
              <span className="feature-icon">🔐</span>
              <h3>Network Attacks</h3>
              <p>SSH, FTP, RDP, SMB, and more</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🌐</span>
              <h3>Web Testing</h3>
              <p>Admin panels and web applications</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">💾</span>
              <h3>Database Testing</h3>
              <p>MySQL, PostgreSQL security</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📊</span>
              <h3>Real-time Monitoring</h3>
              <p>Live attack progress and results</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '⚠️ Legal & Ethical Use',
      content: (
        <div className="onboarding-step legal-step">
          <h2>⚠️ Critical Legal Notice</h2>
          <p className="warning-text">This tool is for EDUCATIONAL and AUTHORIZED TESTING ONLY!</p>
          
          <div className="legal-section">
            <h3 className="legal-title green">✅ What is LEGAL:</h3>
            <ul className="legal-list">
              <li>✓ Testing systems you own</li>
              <li>✓ Testing with written authorization</li>
              <li>✓ Educational labs and practice environments</li>
              <li>✓ Bug bounty programs within scope</li>
              <li>✓ Authorized penetration testing contracts</li>
            </ul>
          </div>
          
          <div className="legal-section">
            <h3 className="legal-title red">❌ What is ILLEGAL:</h3>
            <ul className="legal-list">
              <li>✗ Testing without permission</li>
              <li>✗ Accessing others' accounts or data</li>
              <li>✗ Causing damage or disruption</li>
              <li>✗ Exceeding authorized scope</li>
              <li>✗ Not disclosing vulnerabilities</li>
            </ul>
          </div>
          
          <div className="consequences-box">
            <h4>⚖️ Consequences of Illegal Use:</h4>
            <p>• Criminal prosecution</p>
            <p>• Fines up to $250,000+</p>
            <p>• Prison time (up to 20 years)</p>
            <p>• Civil lawsuits</p>
            <p>• Permanent criminal record</p>
          </div>
          
          <div className="checkbox-container">
            <label className="legal-checkbox">
              <input 
                type="checkbox" 
                id="legal-agreement" 
                checked={legalAgreed}
                onChange={(e) => setLegalAgreed(e.target.checked)}
                required 
              />
              <span>I understand and agree to use this tool legally and ethically</span>
            </label>
          </div>
        </div>
      )
    },
    {
      title: '🎯 Dashboard Overview',
      content: (
        <div className="onboarding-step">
          <h2>📊 Your Command Center</h2>
          <p>The dashboard gives you a complete overview of your security testing activities.</p>
          
          <div className="dashboard-tour">
            <div className="tour-item">
              <span className="tour-number">1</span>
              <div className="tour-content">
                <h3>Statistics Cards</h3>
                <p>View total attacks, discovered credentials, success rates, and active targets at a glance</p>
              </div>
            </div>
            
            <div className="tour-item">
              <span className="tour-number">2</span>
              <div className="tour-content">
                <h3>Recent Attacks</h3>
                <p>Monitor your latest penetration tests with real-time status updates</p>
              </div>
            </div>
            
            <div className="tour-item">
              <span className="tour-number">3</span>
              <div className="tour-content">
                <h3>Quick Actions</h3>
                <p>Launch new attacks, manage targets, and view results quickly</p>
              </div>
            </div>
            
            <div className="tour-item">
              <span className="tour-number">4</span>
              <div className="tour-content">
                <h3>VPN Status</h3>
                <p>Always check your VPN is active before launching attacks</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '⚔️ Attack Types',
      content: (
        <div className="onboarding-step">
          <h2>🎯 Choose Your Attack Vector</h2>
          <p>Different protocols require different approaches. Here are the main attack types:</p>
          
          <div className="attack-types-grid">
            <div className="attack-type-card">
              <h3>🔐 SSH Attack</h3>
              <p><strong>Port:</strong> 22</p>
              <p><strong>Use For:</strong> Servers, routers, IoT devices</p>
              <p><strong>Common Targets:</strong> Linux/Unix systems</p>
            </div>
            
            <div className="attack-type-card">
              <h3>📁 FTP Attack</h3>
              <p><strong>Port:</strong> 21</p>
              <p><strong>Use For:</strong> File servers, legacy systems</p>
              <p><strong>Common Targets:</strong> File transfer services</p>
            </div>
            
            <div className="attack-type-card">
              <h3>🌐 Web Attack</h3>
              <p><strong>Ports:</strong> 80, 443</p>
              <p><strong>Use For:</strong> Admin panels, CMS systems</p>
              <p><strong>Common Targets:</strong> WordPress, Joomla, custom apps</p>
            </div>
            
            <div className="attack-type-card">
              <h3>🖥️ RDP Attack</h3>
              <p><strong>Port:</strong> 3389</p>
              <p><strong>Use For:</strong> Windows Remote Desktop</p>
              <p><strong>Common Targets:</strong> Windows servers, workstations</p>
            </div>
            
            <div className="attack-type-card">
              <h3>💾 Database Attack</h3>
              <p><strong>Ports:</strong> 3306 (MySQL), 5432 (PostgreSQL)</p>
              <p><strong>Use For:</strong> Database servers</p>
              <p><strong>Common Targets:</strong> Application databases</p>
            </div>
            
            <div className="attack-type-card">
              <h3>📂 SMB Attack</h3>
              <p><strong>Port:</strong> 445</p>
              <p><strong>Use For:</strong> Windows file sharing</p>
              <p><strong>Common Targets:</strong> Windows networks, NAS devices</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '🚀 Your First Attack',
      content: (
        <div className="onboarding-step">
          <h2>🎮 Let's Get Started Safely!</h2>
          <p>Here's the recommended workflow for your first penetration test:</p>
          
          <div className="workflow-steps">
            <div className="workflow-step">
              <div className="workflow-number">1</div>
              <div className="workflow-info">
                <h3>🎯 Add a Target</h3>
                <p>Go to <strong>Targets</strong> → Click "Add Target"</p>
                <p>Enter your authorized target's IP or hostname</p>
                <p className="tip">💡 Tip: Start with your own test environment!</p>
              </div>
            </div>
            
            <div className="workflow-step">
              <div className="workflow-number">2</div>
              <div className="workflow-info">
                <h3>🔍 Scan the Target</h3>
                <p>Go to <strong>Scanner</strong> → Enter target address</p>
                <p>Discover open ports and running services</p>
                <p className="tip">💡 Tip: Scanning is safe and non-invasive!</p>
              </div>
            </div>
            
            <div className="workflow-step">
              <div className="workflow-number">3</div>
              <div className="workflow-info">
                <h3>📚 Prepare Wordlists</h3>
                <p>Go to <strong>Wordlists</strong> → Upload or use default lists</p>
                <p>Choose appropriate wordlists for your target</p>
                <p className="tip">💡 Tip: Smaller wordlists = faster testing!</p>
              </div>
            </div>
            
            <div className="workflow-step">
              <div className="workflow-number">4</div>
              <div className="workflow-info">
                <h3>⚔️ Launch Attack</h3>
                <p>Go to <strong>Attacks</strong> → Click "New Attack"</p>
                <p>Select attack type based on scan results</p>
                <p>Configure threads and timeout</p>
                <p className="tip">💡 Tip: Start with 4-8 threads!</p>
              </div>
            </div>
            
            <div className="workflow-step">
              <div className="workflow-number">5</div>
              <div className="workflow-info">
                <h3>📊 Monitor & Analyze</h3>
                <p>Watch real-time progress in Attacks page</p>
                <p>View discovered credentials in <strong>Results</strong></p>
                <p className="tip">💡 Tip: Results auto-refresh during attacks!</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '🛡️ Best Practices',
      content: (
        <div className="onboarding-step">
          <h2>🛡️ Security & Ethics</h2>
          <p>Follow these best practices for safe and legal penetration testing:</p>
          
          <div className="best-practices">
            <div className="practice-section">
              <h3>🔐 1. Always Use VPN</h3>
              <p>• Hide your real IP address</p>
              <p>• Use a reputable VPN service</p>
              <p>• Check VPN status before testing</p>
              <p>• Never test without protection</p>
            </div>
            
            <div className="practice-section">
              <h3>📝 2. Get Authorization</h3>
              <p>• Obtain written permission</p>
              <p>• Define scope clearly</p>
              <p>• Document all activities</p>
              <p>• Stay within boundaries</p>
            </div>
            
            <div className="practice-section">
              <h3>⚙️ 3. Configure Properly</h3>
              <p>• Start with low thread counts</p>
              <p>• Use appropriate timeouts</p>
              <p>• Monitor target availability</p>
              <p>• Avoid overwhelming targets</p>
            </div>
            
            <div className="practice-section">
              <h3>📊 4. Document Everything</h3>
              <p>• Keep detailed logs</p>
              <p>• Export results regularly</p>
              <p>• Note all findings</p>
              <p>• Create comprehensive reports</p>
            </div>
            
            <div className="practice-section">
              <h3>🤝 5. Responsible Disclosure</h3>
              <p>• Report vulnerabilities ethically</p>
              <p>• Give time to patch</p>
              <p>• Don't exploit for harm</p>
              <p>• Help improve security</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '✅ Ready to Start!',
      content: (
        <div className="onboarding-step completion-step">
          <h2>🎉 You're All Set!</h2>
          <p>You've completed the onboarding tutorial. Here's a quick recap:</p>
          
          <div className="recap-grid">
            <div className="recap-card">
              <span className="recap-icon">⚖️</span>
              <h3>Legal & Ethical</h3>
              <p>Always get authorization and follow the law</p>
            </div>
            
            <div className="recap-card">
              <span className="recap-icon">🎯</span>
              <h3>Attack Workflow</h3>
              <p>Target → Scan → Wordlist → Attack → Results</p>
            </div>
            
            <div className="recap-card">
              <span className="recap-icon">🛡️</span>
              <h3>Best Practices</h3>
              <p>Use VPN, document, and test responsibly</p>
            </div>
            
            <div className="recap-card">
              <span className="recap-icon">📚</span>
              <h3>Learning Resources</h3>
              <p>Check docs, use AI assistant, practice safely</p>
            </div>
          </div>
          
          <div className="quick-links">
            <h3>🚀 Quick Start Links:</h3>
            <div className="links-grid">
              <button className="quick-link-btn" onClick={() => handleNavigate('/targets')}>
                🎯 Add Your First Target
              </button>
              <button className="quick-link-btn" onClick={() => handleNavigate('/scanner')}>
                🔍 Scan a Target
              </button>
              <button className="quick-link-btn" onClick={() => handleNavigate('/wordlists')}>
                📚 Manage Wordlists
              </button>
              <button className="quick-link-btn" onClick={() => handleNavigate('/attacks')}>
                ⚔️ Launch an Attack
              </button>
            </div>
          </div>
          
          <div className="completion-message">
            <p className="ai-message">
              🤖 <strong>AI Assistant:</strong> I'm always here to help! 
              Look for tips and hints throughout the interface. Happy testing!
            </p>
          </div>
        </div>
      )
    }
  ];

  const handleNavigate = (path) => {
    completeOnboarding();
    navigate(path);
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!legalAgreed) {
        alert('You must agree to the legal terms to continue.');
        return;
      }
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    setShowSkipConfirm(true);
  };

  const confirmSkip = (confirmed) => {
    setShowSkipConfirm(false);
    if (confirmed) {
      completeOnboarding();
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_complete', 'true');
    localStorage.setItem('onboarding_completed_at', new Date().toISOString());
    setShowOnboarding(false);
    if (onComplete) {
      onComplete();
    }
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboarding_complete');
    localStorage.removeItem('onboarding_completed_at');
    setCurrentStep(0);
    setShowOnboarding(true);
  };

  if (!showOnboarding) {
    return null;
  }

  return (
    <div className="onboarding-overlay">
      {showSkipConfirm && (
        <div className="skip-confirm-modal">
          <div className="skip-confirm-content">
            <h3>⚠️ Skip Onboarding?</h3>
            <p>Are you sure you want to skip the tutorial? You can always access help from the dashboard.</p>
            <div className="skip-confirm-buttons">
              <button className="btn-secondary" onClick={() => confirmSkip(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => confirmSkip(true)}>
                Yes, Skip
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h1>{steps[currentStep].title}</h1>
          <button className="skip-btn" onClick={skipOnboarding}>Skip Tutorial</button>
        </div>
        
        <div className="onboarding-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <p className="progress-text">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
        
        <div className="onboarding-content">
          {steps[currentStep].content}
        </div>
        
        <div className="onboarding-footer">
          <button 
            className="btn-secondary" 
            onClick={prevStep} 
            disabled={currentStep === 0}
          >
            ← Previous
          </button>
          
          <div className="step-indicators">
            {steps.map((_, index) => (
              <span 
                key={index} 
                className={`step-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>
          
          {currentStep < steps.length - 1 ? (
            <button className="btn-primary" onClick={nextStep}>
              Next →
            </button>
          ) : (
            <button className="btn-success" onClick={completeOnboarding}>
              Get Started! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Export a function to reset onboarding (for testing or re-running the tutorial)
export const resetOnboardingState = () => {
  localStorage.removeItem('onboarding_complete');
  localStorage.removeItem('onboarding_completed_at');
};

export default Onboarding;
