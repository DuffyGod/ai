/**
 * Shuffle an array in place
 */
export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Get a random item from an array
 */
export function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Format date string
 */
export function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Generate a game question
 * @param {Array} availableColors - List of color objects {name, value}
 * @param {string} lastColor - The color value used in the previous question (optional)
 */
export function generateQuestion(availableColors, lastColor = null) {
    if (availableColors.length < 2) {
        throw new Error("Need at least 2 colors to play");
    }

    // 1. Select the color that will be displayed (The Answer)
    // This is the INK color.
    // If lastColor is provided, avoid using it
    let answerColor;
    if (lastColor && availableColors.length > 2) {
        // Filter out the last color to avoid repetition
        const filteredColors = availableColors.filter(c => c.value !== lastColor);
        answerColor = getRandomItem(filteredColors);
    } else {
        answerColor = getRandomItem(availableColors);
    }

    // 2. Select the text content
    // This must be a color name DIFFERENT from the answer color's name
    let textContentColor;
    do {
        textContentColor = getRandomItem(availableColors);
    } while (textContentColor.name === answerColor.name);

    // 3. Generate Options
    // One option is the Answer Color Name
    // Others are random color names (different from Answer Color Name)
    const options = [answerColor.name];
    const otherColors = availableColors.filter(c => c.name !== answerColor.name);
    
    // We need 3 more distractors. 
    // If we don't have enough colors, we might have duplicates in distractors, 
    // but the requirement says "Four options".
    // Let's shuffle otherColors and take 3.
    const shuffledOthers = shuffle([...otherColors]);
    
    // If we have less than 3 other colors, we might need to repeat, but let's assume we have enough.
    // If not enough, just take what we have and maybe duplicate? 
    // Ideally the settings should enforce min 4 colors.
    
    for (let i = 0; i < 3; i++) {
        // Use modulo to cycle if not enough colors
        options.push(shuffledOthers[i % shuffledOthers.length].name);
    }

    return {
        text: textContentColor.name, // The word displayed
        color: answerColor.value,    // The color of the word (The Answer)
        answer: answerColor.name,    // The correct option text
        options: shuffle(options)    // Shuffled options
    };
}