// Global variables
let benefitsData = [];
let userResponses = {};
let currentQuestion = 1;
const totalQuestions = 6;

// DOM elements
const questionnaire = document.getElementById('questionnaire');
const results = document.getElementById('results');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const form = document.getElementById('benefits-form');
const benefitsList = document.getElementById('benefits-list');
const noBenefits = document.getElementById('no-benefits');
const restartBtn = document.getElementById('restart-btn');
const restartBtnTop = document.getElementById('restart-btn-top');
const retryBtn = document.getElementById('retry-btn');

// Navigation elements
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const progressFill = document.getElementById('progress-fill');
const currentQuestionSpan = document.getElementById('current-question');
const totalQuestionsSpan = document.getElementById('total-questions');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadBenefitsData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    form.addEventListener('submit', handleFormSubmit);
    restartBtn.addEventListener('click', restartQuestionnaire);
    restartBtnTop.addEventListener('click', restartQuestionnaire);
    retryBtn.addEventListener('click', loadBenefitsData);
    
    // Navigation event listeners
    nextBtn.addEventListener('click', nextQuestion);
    prevBtn.addEventListener('click', prevQuestion);
    
    // Handle "none" checkbox exclusivity
    const noneCheckbox = document.querySelector('input[name="circumstances"][value="none"]');
    const otherCheckboxes = document.querySelectorAll('input[name="circumstances"]:not([value="none"])');
    
    if (noneCheckbox && otherCheckboxes.length > 0) {
        noneCheckbox.addEventListener('change', function() {
            if (this.checked) {
                otherCheckboxes.forEach(cb => cb.checked = false);
            }
        });
        
        otherCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked) {
                    noneCheckbox.checked = false;
                }
            });
        });
    }
    
    // Initialize question navigation
    updateQuestionDisplay();
}

// Load benefits data from CSV
function loadBenefitsData() {
    showSection('loading');
    
    Papa.parse('benefits-data.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.errors.length > 0) {
                console.error('CSV parsing errors:', results.errors);
                showSection('error');
                return;
            }
            
            benefitsData = results.data;
            console.log('Benefits data loaded:', benefitsData.length, 'records');
            showSection('questionnaire');
        },
        error: function(error) {
            console.error('Error loading CSV:', error);
            showSection('error');
        }
    });
}

// Handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    
    // Collect form data
    const formData = new FormData(form);
    userResponses = {
        age: formData.get('age'),
        income: formData.get('income'),
        household: formData.get('household'),
        employment: formData.get('employment'),
        housing: formData.get('housing'),
        circumstances: formData.getAll('circumstances')
    };
    
    console.log('User responses:', userResponses);
    
    // Find matching benefits
    const matchingBenefits = findMatchingBenefits();
    displayResults(matchingBenefits);
}

// Find benefits that match user responses
function findMatchingBenefits() {
    return benefitsData.filter(benefit => {
        // Check each eligibility criterion based on new CSV structure
        if (!checkAgeEligibility(benefit)) return false;
        if (!checkIncomeEligibility(benefit)) return false;
        if (!checkHousingEligibility(benefit)) return false;
        if (!checkCircumstancesEligibility(benefit)) return false;
        
        return true;
    });
}

// Age eligibility check
function checkAgeEligibility(benefit) {
    // If benefit doesn't require age-based eligibility, it's available to all
    if (benefit.Age !== 'TRUE') return true;
    
    const userAge = userResponses.age;
    const minAge = benefit['Age Min'] ? parseInt(benefit['Age Min']) : null;
    const maxAge = benefit['Age Max'] ? parseInt(benefit['Age Max']) : null;
    
    // Convert user age selection to numeric ranges for comparison
    let userAgeMin, userAgeMax;
    
    switch(userAge) {
        case 'under18':
            userAgeMin = 0;
            userAgeMax = 17;
            break;
        case '18-64':
            userAgeMin = 18;
            userAgeMax = 64;
            break;
        case '65plus':
            userAgeMin = 65;
            userAgeMax = 120;
            break;
        default:
            return false;
    }
    
    // Check if user age range overlaps with benefit age requirements
    if (minAge !== null && userAgeMax < minAge) return false;
    if (maxAge !== null && userAgeMin > maxAge) return false;
    
    return true;
}

// Income eligibility check
function checkIncomeEligibility(benefit) {
    // If benefit doesn't require income-based eligibility, it's available to all
    if (benefit.Income !== 'TRUE') return true;
    
    const userIncome = userResponses.income;
    
    // Income-based benefits are typically for low/moderate income individuals
    return userIncome === 'low' || userIncome === 'moderate';
}


// Housing eligibility check
function checkHousingEligibility(benefit) {
    // If benefit doesn't require homeownership, it's available to all
    if (benefit.Own_Housing !== 'TRUE') return true;
    
    const userHousing = userResponses.housing;
    
    // Housing-specific benefits are typically for homeowners
    return userHousing === 'owner';
}

// Special circumstances eligibility check
function checkCircumstancesEligibility(benefit) {
    const userCircumstances = userResponses.circumstances;
    
    // Check disability-specific benefits
    if (benefit.Disability === 'TRUE') {
        if (!userCircumstances.includes('disability')) return false;
    }
    
    // Check veteran-specific benefits
    if (benefit.Veteran === 'TRUE') {
        if (!userCircumstances.includes('veteran')) return false;
    }
    
    return true;
}

// Display results
function displayResults(matchingBenefits) {
    if (matchingBenefits.length === 0) {
        benefitsList.innerHTML = '';
        noBenefits.style.display = 'block';
    } else {
        noBenefits.style.display = 'none';
        benefitsList.innerHTML = matchingBenefits.map(createBenefitCard).join('');
    }
    
    showSection('results');
}

// Create benefit card HTML
function createBenefitCard(benefit) {
    const title = benefit.Service || 'Unnamed Benefit';
    const description = benefit.Description || 'No description available.';
    const url = benefit.URL || '#';
    const department = benefit.Department || '';
    const linkText = 'Learn More & Apply';
    
    return `
        <div class="benefit-card">
            <div class="benefit-title">${escapeHtml(title)}</div>
            ${department ? `<div class="benefit-department">${escapeHtml(department)}</div>` : ''}
            <div class="benefit-description">${escapeHtml(description)}</div>
            <a href="${escapeHtml(url)}" target="_blank" class="benefit-link" rel="noopener noreferrer">
                ${escapeHtml(linkText)}
            </a>
        </div>
    `;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show specific section
function showSection(sectionName) {
    const sections = ['questionnaire', 'results', 'loading', 'error'];
    sections.forEach(section => {
        const element = document.getElementById(section);
        if (element) {
            element.classList.toggle('active', section === sectionName);
        }
    });
}

// Question Navigation Functions
function nextQuestion() {
    if (currentQuestion < totalQuestions) {
        // Validate current question before proceeding
        if (validateCurrentQuestion()) {
            currentQuestion++;
            updateQuestionDisplay();
        }
    }
}

function prevQuestion() {
    if (currentQuestion > 1) {
        currentQuestion--;
        updateQuestionDisplay();
    }
}

function updateQuestionDisplay() {
    // Hide all question slides
    const questionSlides = document.querySelectorAll('.question-slide');
    questionSlides.forEach(slide => {
        slide.classList.remove('active');
    });
    
    // Show current question
    const currentSlide = document.querySelector(`[data-question="${currentQuestion}"]`);
    if (currentSlide) {
        currentSlide.classList.add('active');
    }
    
    // Update progress bar
    const progressPercent = (currentQuestion / totalQuestions) * 100;
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }
    
    // Update progress text
    if (currentQuestionSpan) {
        currentQuestionSpan.textContent = currentQuestion;
    }
    if (totalQuestionsSpan) {
        totalQuestionsSpan.textContent = totalQuestions;
    }
    
    // Update button visibility
    prevBtn.style.display = currentQuestion === 1 ? 'none' : 'inline-block';
    
    if (currentQuestion === totalQuestions) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

function validateCurrentQuestion() {
    const currentSlide = document.querySelector(`[data-question="${currentQuestion}"]`);
    if (!currentSlide) return false;
    
    // Check for radio buttons
    const radioInputs = currentSlide.querySelectorAll('input[type="radio"]');
    if (radioInputs.length > 0) {
        const checked = currentSlide.querySelector('input[type="radio"]:checked');
        if (!checked) {
            alert('Please select an option before continuing.');
            return false;
        }
    }
    
    // For the circumstances question (checkboxes), no validation needed as "none" is an option
    
    return true;
}

// Restart questionnaire
function restartQuestionnaire() {
    form.reset();
    userResponses = {};
    currentQuestion = 1;
    updateQuestionDisplay();
    showSection('questionnaire');
}


// Development helper: Add some console logging for debugging
function debugLog(message, data = null) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`[Benefits Screener] ${message}`, data);
    }
}
