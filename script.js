(function () {
// Root: the embed mount on Revize, or the whole page when standalone
const root = document.getElementById('benefits-prescreener') || document;
const BASE = window.BENEFITS_PRESCREENER_BASE || '';

// Global variables
let benefitsData = [];
let userResponses = {};
let currentQuestion = 1;
const totalQuestions = 6;

// DOM elements
const questionnaire = root.querySelector('#questionnaire');
const results = root.querySelector('#results');
const loading = root.querySelector('#loading');
const error = root.querySelector('#error');
const form = root.querySelector('#benefits-form');
const benefitsList = root.querySelector('#benefits-list');
const noBenefits = root.querySelector('#no-benefits');
const restartBtn = root.querySelector('#restart-btn');
const restartBtnTop = root.querySelector('#restart-btn-top');
const retryBtn = root.querySelector('#retry-btn');
const questionError = root.querySelector('#question-error');

// Navigation elements
const prevBtn = root.querySelector('#prev-btn');
const nextBtn = root.querySelector('#next-btn');
const submitBtn = root.querySelector('#submit-btn');
const progressFill = root.querySelector('#progress-fill');
const currentQuestionSpan = root.querySelector('#current-question');
const totalQuestionsSpan = root.querySelector('#total-questions');

// Initialize the application
function init() {
    loadBenefitsData();
    setupEventListeners();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

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
    const noneCheckbox = root.querySelector('input[name="circumstances"][value="none"]');
    const otherCheckboxes = root.querySelectorAll('input[name="circumstances"]:not([value="none"])');
    
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
    
    Papa.parse(BASE + 'benefits-data.csv', {
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
        case '18-59':
            userAgeMin = 18;
            userAgeMax = 59;
            break;
        case '60-64':
            userAgeMin = 60;
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
    
    // Use the program's limit for the household size when the CSV gives one
    const householdColumns = {
        single: 'Income Limit 1',
        two: 'Income Limit 2',
        three: 'Income Limit 3',
        large: 'Income Limit 4'
    };
    const limit = parseInt(benefit[householdColumns[userResponses.household]]);
    
    if (!isNaN(limit)) {
        // Lowest income in each answer range; show if it is under the limit
        const incomeRangeMin = { low: 0, moderate: 30000, high: 60001 };
        return incomeRangeMin[userIncome] < limit;
    }
    
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
    
    // Check child-related benefits - only show if children under 18 is checked
    const childRelatedBenefits = [
        'Child Care Assistance'
    ];

    if (childRelatedBenefits.includes(benefit.Service)) {
        if (!userCircumstances.includes('children')) return false;
    }

    // WIC - pregnant women or households with children
    if (benefit.Service === 'WIC - Women Infants and Children') {
        if (!userCircumstances.includes('children') && !userCircumstances.includes('pregnant')) return false;
    }
    
    // U-Pass - only for students and employees of participating schools and employers
    if (benefit.Service === 'People Mover U-Pass') {
        if (userResponses.employment !== 'employed' && userResponses.employment !== 'student') return false;
    }
    
    // Youth rides free - show to youth themselves or households with children
    if (benefit.Service === 'People Mover Youth Connect') {
        if (userResponses.age !== 'under18' && !userCircumstances.includes('children')) return false;
    }

    // Senior OR disability benefits - show for listed age groups or disability
    const seniorOrDisabilityBenefits = {
        'People Mover Half Fare Medicare': ['65plus'],
        'Chugach Manor and Spruce View Services': ['60-64', '65plus']
    };

    if (seniorOrDisabilityBenefits[benefit.Service]) {
        if (!seniorOrDisabilityBenefits[benefit.Service].includes(userResponses.age) &&
            !userCircumstances.includes('disability')) return false;
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
    root.querySelector('#results-heading').focus();
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
        const element = root.querySelector('#' + section);
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
            focusCurrentQuestion();
        }
    }
}

function prevQuestion() {
    if (currentQuestion > 1) {
        currentQuestion--;
        updateQuestionDisplay();
        focusCurrentQuestion();
    }
}

function updateQuestionDisplay() {
    // Hide all question slides
    const questionSlides = root.querySelectorAll('.question-slide');
    questionSlides.forEach(slide => {
        slide.classList.remove('active');
    });
    
    // Show current question
    const currentSlide = root.querySelector(`[data-question="${currentQuestion}"]`);
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

// Move keyboard and screen reader focus to the current question
function focusCurrentQuestion() {
    const legend = root.querySelector(`[data-question="${currentQuestion}"] legend`);
    if (legend) legend.focus();
}

function validateCurrentQuestion() {
    const currentSlide = root.querySelector(`[data-question="${currentQuestion}"]`);
    if (!currentSlide) return false;
    
    // Check for radio buttons
    const radioInputs = currentSlide.querySelectorAll('input[type="radio"]');
    if (radioInputs.length > 0) {
        const checked = currentSlide.querySelector('input[type="radio"]:checked');
        if (!checked) {
            questionError.textContent = 'Please select an option before continuing.';
            radioInputs[0].focus();
            return false;
        }
    }
    
    // For the circumstances question (checkboxes), no validation needed as "none" is an option
    
    questionError.textContent = '';
    return true;
}

// Restart questionnaire
function restartQuestionnaire() {
    form.reset();
    userResponses = {};
    currentQuestion = 1;
    questionError.textContent = '';
    updateQuestionDisplay();
    showSection('questionnaire');
    focusCurrentQuestion();
}


// Development helper: Add some console logging for debugging
function debugLog(message, data = null) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`[Benefits Screener] ${message}`, data);
    }
}
})();
