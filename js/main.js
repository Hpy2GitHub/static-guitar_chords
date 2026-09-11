

/**
 * @file main.js
 * This file combines chord generation logic from index14.js and rendering logic from the original main.js.
 * It is intended to be used as a library, with UI event listeners handled separately.
 */

// --- Part 1: Constants and Core Note Helpers (from index14.js) ---

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const GUITAR_TUNING = ['E', 'A', 'D', 'G', 'B', 'E']; // Standard tuning EADGBe (string 6 to 1)
const FRET_COUNT = 24;
const NOTE_MAP = {};
ALL_NOTES.forEach((note, i) => NOTE_MAP[note] = i);

/**
 * Converts a note name to its MIDI-like number (0-11).
 */
function noteToNumber(note) {
    note = note.replace('b', '#'); // Convert flats to sharps for consistency
    if (note.length > 1 && note.charAt(1) === '#') {
        const baseNote = note.charAt(0);
        const baseValue = NOTE_MAP[baseNote];
        return (baseValue + 1) % 12;
    }
    return NOTE_MAP[note];
}

/**
 * Converts a numeric note value back to its name.
 */
function numberToNote(num) {
    return ALL_NOTES[num % 12];
}

/**
 * Creates a representation of the guitar neck, with each fret on each string mapped to a note number.
 */
function createGuitarNeck() {
    const neck = [];
    for (let i = 0; i < GUITAR_TUNING.length; i++) {
        const stringNotes = [];
        const openNote = noteToNumber(GUITAR_TUNING[i]);
        for (let fret = 0; fret <= FRET_COUNT; fret++) {
            stringNotes.push((openNote + fret) % 12);
        }
        neck.push(stringNotes);
    }
    // GUITAR_TUNING is already ordered low E -> high E (string 6 to string 1),
    // so neck[0] is already the low E string - no reverse needed.
    return neck;
}

const guitarNeck = createGuitarNeck();


// --- Part 2: Fingering Calculation Logic (from index14.js) ---

/**
 * Finds all possible fingerings for a given set of chord notes.
 */
function findChordFingerings(chordNotes, firstFret, fretRange, rootNote) {
    const chordNoteNumbers = chordNotes.map(noteToNumber);
    const rootNoteNumber = rootNote ? noteToNumber(rootNote) : chordNoteNumbers[0];
    const possibleFingerings = [];

    function findCombinations(stringIndex, currentFingering) {
        if (stringIndex === GUITAR_TUNING.length) {
            if (isValidFingering(currentFingering, chordNoteNumbers, rootNoteNumber)) {
                possibleFingerings.push(currentFingering);
            }
            return;
        }

        // Option 1: Don't play this string (mute or skip)
        findCombinations(stringIndex + 1, [...currentFingering, null]);

        // Option 2: Play a note on this string
        for (let fret = firstFret; fret < firstFret + fretRange; fret++) {
            if (fret === 0 && firstFret > 0) continue;
            const noteOnFret = guitarNeck[stringIndex][fret];
            if (chordNoteNumbers.includes(noteOnFret)) {
                findCombinations(stringIndex + 1, [...currentFingering, { string: stringIndex + 1, fret, note: numberToNote(noteOnFret) }]);
            }
        }
    }

    findCombinations(0, []);
    return possibleFingerings.map(normalizeFingering).filter(f => f !== null);
}

/**
 * Checks if a given fingering is valid.
 */
function isValidFingering(fingering, chordNoteNumbers, rootNoteNumber) {
    const playedNotes = fingering.filter(f => f !== null).map(f => noteToNumber(f.note));
    if (playedNotes.length < 3) return false;

    for (const note of chordNoteNumbers) {
        if (!playedNotes.includes(note)) {
            return false;
        }
    }
    
    const frets = fingering.filter(f => f !== null).map(f => f.fret);
    const lowestFret = Math.min(...frets.filter(f => f > 0));
    return playedNotes.includes(rootNoteNumber);
}

/**
 * Normalizes a fingering by adjusting fret numbers and removing unplayed strings.
 */
function normalizeFingering(fingering) {
    const played = fingering.filter(f => f !== null);
    if (played.length === 0) return null;

    const frets = played.map(p => p.fret).filter(f => f > 0);
    const minFret = frets.length > 0 ? Math.min(...frets) : 0;
    const maxFret = frets.length > 0 ? Math.max(...frets) : 0;

    if (maxFret - minFret > 5) return null;

    return {
        frets: played,
        startFret: minFret,
        notes: played.map(p => p.note).join('-')
    };
}


// --- Part 3: Renderer and Labeler Classes (from original main.js) ---

class GuitarFretLabeler {
    // ... (content of GuitarFretLabeler class from original main.js)
    calculateFretLabeling(chordData) {
        const chord = chordData.chords[0];
        const placementFret = chord.placement_fret;

        const rootMark = this.findRootNoteMark(chord);
        const rootFretNumber = placementFret;
        const rootFretDisplay = placementFret.toString().padEnd(3, ' '); // 2 digits + space

        const diagramRange = this.calculateDiagramRange(chord, rootFretNumber);
        const labelPosition = this.calculateLabelPosition(chord, rootFretNumber, diagramRange);

        return {
            rootFretNumber,
            labelFret: rootFretDisplay,
            diagramStartFret: diagramRange.startFret,
            diagramEndFret: diagramRange.endFret,
            shouldShowOpenStrings: diagramRange.startFret === 0,
            labelPosition
        };
    }
    
    findRootNoteMark(chord) {
        for (let mark of chord.intervals_marks) {
            const [string, fret, interval] = mark;
            if (interval.trim() === 'R') {
                return { string, fretOffset: fret, interval };
            }
        }
        const rootMark = chord.finger_marks.find(mark => mark[0] === chord.template.root_string);
        if (rootMark) {
            return { string: rootMark[0], fretOffset: rootMark[1], interval: 'R' };
        }
        return null;
    }
    
    calculateDiagramRange(chord, rootFretNumber) {
        const diagramLength = 5;
        if (rootFretNumber <= 3) {
            return { startFret: 0, endFret: diagramLength - 1 };
        }
        const startFret = Math.max(1, rootFretNumber - 2);
        return { startFret, endFret: startFret + diagramLength - 1 };
    }
    
    calculateLabelPosition(chord, rootFretNumber, diagramRange) {
        const positionInDiagram = rootFretNumber - diagramRange.startFret;
        return {
            diagramRow: positionInDiagram + 1,
            fretNumber: rootFretNumber,
            displayText: rootFretNumber.toString().padStart(2, '0')
        };
    }
    
    formatFretLabel(fretNumber) {
        return fretNumber.toString().padEnd(3, ' ');
    }
    
    labelChordFrets(jsonData) {
        const result = this.calculateFretLabeling(jsonData);
        result.displayLabel = this.formatFretLabel(result.labelFret);
        result.isOpenChord = result.shouldShowOpenStrings;
        return result;
    }
}

class GuitarSVGRenderer {
    // ... (content of GuitarSVGRenderer class from original main.js)
    constructor() {
        this.svgNS = "http://www.w3.org/2000/svg";
        this.defaultConfig = {
            width: 350,
            stringCount: 6,
            stringSpacing: 40,
            fretSpacing: 30,
            margin: 20,
            circleRadius: 10,
            fontSize: {
                fretNumber: 12,
                chordLabel: 10,
                title: 12,
                debugInfo: 9
            },
            colors: {
                fretLine: "black",
                stringLine: "black",
                rootNote: "#00ff00",
                normalNote: "#000000",
                rootText: "#000000",
                normalText: "#ffffff",
                debugText: "#666666"
            }
        };
    }
    
    createChordSVG(marks, title, placementFret, formLength, templateId, diagramType, chordIndex, labelingInfo = null) {
        const cfg = this.defaultConfig;
        const svg = document.createElementNS(this.svgNS, "svg");
        
        const fretCount = formLength + 1;
        const topPadding = 30;
        const circlePadding = cfg.circleRadius;
        const baseHeight = cfg.margin * 2 + (fretCount * cfg.fretSpacing);
        const titleHeight = 30;
        const debugHeight = 50; // Always show debug info
        const totalHeight = topPadding + circlePadding + baseHeight + titleHeight + debugHeight;
        
        svg.setAttribute("width", cfg.width);
        svg.setAttribute("height", totalHeight);

        // A fingering that includes a real open string (not muted) is an open-position
        // chord, even if its lowest fretted note is fret 1+ - don't label it with a
        // fret number, since that would misleadingly imply a movable/barred shape.
        const hasOpenString = marks.some(([, fret, label]) => fret === 0 && label.trim().toLowerCase() !== 'x');

        this.drawFrets(svg, cfg, fretCount, placementFret, labelingInfo, topPadding + circlePadding, hasOpenString);
        this.drawStrings(svg, cfg, fretCount, topPadding + circlePadding);
        this.drawMarks(svg, cfg, marks, title, diagramType, placementFret, topPadding + circlePadding);
        this.drawTitle(svg, cfg, chordIndex, templateId, diagramType, placementFret, fretCount, topPadding + circlePadding);
        
        if (true) { // Always show debug info
            this.drawDebugInfo(svg, cfg, marks, placementFret, fretCount, topPadding + circlePadding);
        }
        
        return svg;
    }
    
    drawFrets(svg, cfg, fretCount, fretStart, labelingInfo, topPadding = 0, hasOpenString = false) {
        for (let i = 0; i <= fretCount; i++) {
            const y = topPadding + cfg.margin + i * cfg.fretSpacing;
            const line = document.createElementNS(this.svgNS, "line");
            line.setAttribute("x1", cfg.margin);
            line.setAttribute("x2", cfg.margin + (cfg.stringCount - 1) * cfg.stringSpacing);
            line.setAttribute("y1", y);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", cfg.colors.fretLine);
            line.setAttribute("stroke-width", "2");
            svg.appendChild(line);

            this.drawFretLabel(svg, cfg, i, y, fretStart, labelingInfo, hasOpenString);
        }
    }

    drawFretLabel(svg, cfg, fretIndex, yPos, fretStart, labelingInfo, hasOpenString = false) {
        if (labelingInfo && !labelingInfo.isOpenChord) {
            if (fretIndex === labelingInfo.labelPosition.diagramRow - 1) {
                const text = document.createElementNS(this.svgNS, "text");
                text.setAttribute("x", cfg.margin - 20);
                text.setAttribute("y", yPos + 15);
                text.setAttribute("font-size", cfg.fontSize.fretNumber);
                text.textContent = labelingInfo.labelFret;
                svg.appendChild(text);
            }
        } else if (fretIndex === 0 && fretStart > 0 && !labelingInfo && !hasOpenString) {
            const text = document.createElementNS(this.svgNS, "text");
            text.setAttribute("x", cfg.margin - 20);
            text.setAttribute("y", yPos + 15);
            text.setAttribute("font-size", cfg.fontSize.fretNumber);
            text.textContent = fretStart.toString().padEnd(3, ' ');
            svg.appendChild(text);
        }
    }
    
    drawStrings(svg, cfg, fretCount, topPadding = 0) {
        for (let i = 0; i < cfg.stringCount; i++) {
            const x = cfg.margin + i * cfg.stringSpacing;
            const line = document.createElementNS(this.svgNS, "line");
            line.setAttribute("x1", x);
            line.setAttribute("x2", x);
            line.setAttribute("y1", topPadding + cfg.margin);
            line.setAttribute("y2", topPadding + cfg.margin + fretCount * cfg.fretSpacing);
            line.setAttribute("stroke", cfg.colors.stringLine);
            line.setAttribute("stroke-width", "1");
            svg.appendChild(line);
        }
    }
    
    drawMarks(svg, cfg, marks, title, diagramType, placementFret, topPadding = 0) {
        if (!Array.isArray(marks)) {
            console.error('Invalid marks array:', marks);
            return;
        }
        marks.forEach(([string, fret, olabel]) => {
            const label = olabel.trim();
            if (!Number.isInteger(string) || !Number.isInteger(fret) || typeof label !== 'string') return;
            this.drawSingleMark(svg, cfg, string, fret, label, title, placementFret, topPadding);
        });
    }

    drawSingleMark(svg, cfg, string, fret, label, title, placementFret, topPadding = 0) {
        const normalizedLabel = label.toLowerCase().trim();
        const openStringLabels = ["0", "o", "open"];

        if (fret === 0 && (normalizedLabel === "x" || (openStringLabels.includes(normalizedLabel) && title.includes("Fingerings")))) {
            this.drawOpenStringMark(svg, cfg, string, normalizedLabel, title, topPadding);
        } else {
            this.drawFrettedMark(svg, cfg, string, fret, label, title, placementFret, topPadding);
        }
    }
    
    drawOpenStringMark(svg, cfg, string, normalizedLabel, title, topPadding = 0) {
        const text = document.createElementNS(this.svgNS, "text");
        text.setAttribute("x", cfg.margin + (string - 1) * cfg.stringSpacing);
        text.setAttribute("y", topPadding + cfg.margin - 5);
        text.setAttribute("font-size", cfg.fontSize.fretNumber);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#000000");
        text.textContent = normalizedLabel === "x" ? "x" : "o";
        svg.appendChild(text);
    }
    
    drawFrettedMark(svg, cfg, string, fret, label, title, placementFret, topPadding = 0) {
        const x = cfg.margin + (string - 1) * cfg.stringSpacing;
        // Position relative to the diagram's starting fret, not the note's absolute fret,
        // so fingerings that don't start at fret 0/1 (e.g. wider Chord Span searches) line up
        // with the fret-number label drawn by drawFretLabel.
        const relFret = fret === 0 ? 0 : fret - placementFret + 1;
        const y = topPadding + cfg.margin + relFret * cfg.fretSpacing - cfg.fretSpacing / 2;
        const isRoot = label.toLowerCase() === "r";
        const circle = document.createElementNS(this.svgNS, "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", cfg.circleRadius);
        circle.setAttribute("fill", isRoot ? cfg.colors.rootNote : cfg.colors.normalNote);
        svg.appendChild(circle);
        
        const text = document.createElementNS(this.svgNS, "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y + 3);
        text.setAttribute("font-size", cfg.fontSize.chordLabel);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", isRoot ? cfg.colors.rootText : cfg.colors.normalText);
        text.textContent = label;
        svg.appendChild(text);
    }
    
    drawTitle(svg, cfg, chordIndex, templateId, diagramType, placementFret, fretCount, topPadding = 0) {
        const titleText = document.createElementNS(this.svgNS, "text");
        titleText.setAttribute("x", cfg.margin);
        titleText.setAttribute("y", topPadding + cfg.margin + fretCount * cfg.fretSpacing + 25);
        titleText.setAttribute("font-size", cfg.fontSize.title);
        titleText.textContent = `${chordIndex + 1} / ${templateId} / ${diagramType}`;
        svg.appendChild(titleText);
    }
    
    drawDebugInfo(svg, cfg, marks, placementFret, fretCount, topPadding = 0) {
        const debugGroup = document.createElementNS(this.svgNS, "g");
        const fretText = document.createElementNS(this.svgNS, "text");
        fretText.setAttribute("x", cfg.margin);
        fretText.setAttribute("y", topPadding + cfg.margin + fretCount * cfg.fretSpacing + 40);
        fretText.setAttribute("font-size", cfg.fontSize.debugInfo);
        fretText.setAttribute("fill", cfg.colors.debugText);
        fretText.textContent = `Fret: ${placementFret}`;
        debugGroup.appendChild(fretText);
        
        const marksText = document.createElementNS(this.svgNS, "text");
        marksText.setAttribute("x", cfg.margin);
        marksText.setAttribute("y", topPadding + cfg.margin + fretCount * cfg.fretSpacing + 55);
        marksText.setAttribute("font-size", cfg.fontSize.debugInfo);
        marksText.setAttribute("fill", cfg.colors.debugText);
        const formattedMarks = marks.map(m => `(${m[0]},${m[1]},'${m[2]}')`).join(', ');
        marksText.textContent = `Marks: [${formattedMarks}]`;
        debugGroup.appendChild(marksText);
        
        svg.appendChild(debugGroup);
    }
}


// --- Part 4: Global Class Instances ---

const fretLabeler = new GuitarFretLabeler();
const svgRenderer = new GuitarSVGRenderer();


// --- Part 5: High-Level Functions ---

const SEMITONES_TO_INTERVAL = {
    0: 'R', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4',
    6: '#4', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7'
};

function getInterval(rootNoteNum, noteNum) {
    const diff = (12 + noteNum - rootNoteNum) % 12;
    return SEMITONES_TO_INTERVAL[diff];
}

/**
 * Generates chord diagrams from a list of notes and renders them to the specified DOM element.
 * This is for the "Notes" tab.
 */
function generateChordsFromNotes(notesString, firstFret, fretRange, rootNote, outputElementId) {
    const outputDiv = document.getElementById(outputElementId);
    if (!outputDiv) {
        console.error(`Output element #${outputElementId} not found.`);
        return;
    }
    if (!notesString) {
        outputDiv.innerHTML = '<p class="error-message">Please enter chord notes.</p>';
        return;
    }

    const chordNotes = notesString.split(/\s+/).map(n => n.charAt(0).toUpperCase() + n.slice(1));
    const fingerings = findChordFingerings(chordNotes, firstFret, fretRange, rootNote);

    outputDiv.innerHTML = ''; // Clear previous results

    if (fingerings.length === 0) {
        outputDiv.innerHTML = '<p class="error-message">No fingerings found for the given notes and constraints.</p>';
        return;
    }

    const diagramsContainer = document.createElement('div');
    diagramsContainer.className = 'chord-diagrams';

    const rootNoteNum = noteToNumber(chordNotes[0]);

    fingerings.slice(0, 5).forEach((fingering, index) => { // Limit to 5 fingerings to avoid clutter
        const row = document.createElement('div');
        row.className = 'chord-row';

        const diagrams = [
            {
                type: 'Notes',
                marks: fingering.frets.map(pos => [pos.string, pos.fret, pos.note])
            },
            {
                type: 'Intervals',
                marks: fingering.frets.map(pos => {
                    const noteNum = noteToNumber(pos.note);
                    const interval = getInterval(rootNoteNum, noteNum);
                    return [pos.string, pos.fret, interval];
                })
            },
            {
                type: 'Frets',
                marks: fingering.frets.map(pos => [pos.string, pos.fret, pos.fret.toString()])
            }
        ];

        diagrams.forEach(diagram => {
            const diagramDiv = document.createElement('div');
            diagramDiv.className = 'chord-diagram';

            const svg = svgRenderer.createChordSVG(
                diagram.marks,
                fingering.notes, // title
                fingering.startFret, // placementFret
                4, // formLength
                `Fingering ${index + 1}`, // templateId
                diagram.type, // diagramType
                index, // chordIndex
                null // labelingInfo
            );
            
            diagramDiv.appendChild(svg);
            row.appendChild(diagramDiv);
        });
        diagramsContainer.appendChild(row);
    });

    outputDiv.appendChild(diagramsContainer);
}

/**
 * Builds an array of notes for a given chord name and type.
 * This is the new client-side logic for the "Chord Name" tab.
 */
const CHORD_FORMULAS = {
    'maj': [0, 4, 7], // Major
    'min': [0, 3, 7], // Minor
    'dim': [0, 3, 6], // Diminished
    'aug': [0, 4, 8], // Augmented
    'dom7': [0, 4, 7, 10], // Dominant 7th
    'maj7': [0, 4, 7, 11], // Major 7th
    'min7': [0, 3, 7, 10], // Minor 7th
};

function getNotesForChord(rootNote, chordType) {
    const rootNum = noteToNumber(rootNote);
    const formula = CHORD_FORMULAS[chordType];
    if (!formula) {
        console.error(`Unknown chord type: ${chordType}`);
        return [];
    }
    return formula.map(interval => numberToNote(rootNum + interval));
}
