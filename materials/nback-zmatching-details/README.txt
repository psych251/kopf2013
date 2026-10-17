N-BACK ENGLISH WORD MATCHING: PROPOSED STIMULI

Deliverables
- nback-zmatched-experiment.csv: 10 negative, 10 positive and 10 neutral English nouns.
- nback-zmatched-practice.csv: 30 separate neutral English nouns. No overlap with main task.
- german_original.csv: original 30 German words and their BAWL-R ratings/z-scores.
- normalization.csv: full-database means and SAMPLE SDs used for standardization.
- full_database_zscores.csv: both supplied databases, with valence/arousal z-scores.
- matching_summary.csv: group-level comparison, variability and mean matching distance.
- candidate_pool.csv: the full English candidate pool considered by the algorithm.
- reproduce_matching.py: reproducible selection script.

Sources
German ratings: user's BAWL-R.xlsx, sheet Tabelle1, 2,902 rows. EMO_MEAN and AROUSAL_MEAN.
English ratings: user's BRM-emot-submit.csv, 13,915 rows. V.Mean.Sum and A.Mean.Sum.
Original German stimuli: Kopf et al. (2013), Table 1, DOI 10.1371/journal.pone.0075598.
BAWL-R: Vo et al. (2009), DOI 10.3758/BRM.41.2.534.
Warriner et al. (2013), DOI 10.3758/s13428-012-0314-x.
Source files remain unchanged. No participant observations were generated.

Normalization
For each dimension separately in each FULL database:
z = (word mean rating - mean across word mean ratings) / sample SD across word mean ratings.
SD uses ddof=1. This is across-WORD normalization, not individual-rater normalization.
Do not confuse each word's rating SD column with the database-level SD used here.
No separate standardization by valence group or within the 30 selected words was used.
Both full supplied files have nonmissing mean valence/arousal ratings.

Selection
A manually reviewed candidate pool contains 210 six-letter English nouns present in Warriner.
Candidates were manually transcribed to meet 5 phonemes and 2 syllables in a specified
American-English pronunciation. These are provisional judgments, NOT dictionary-verified
pronunciations. ER counts as one rhotic vowel, and CH/JH as one affricate each. Reduced
vowels, syllabic consonants and accent variation can change phoneme counts. Manual counts
and transcriptions are included for review before adoption.
No frequency, familiarity, imageability, or semantic-category matching was performed.
Some nouns can also be verbs or have multiple senses; normative ratings are word-level.

Hard English valence eligibility: negative <=4.0, positive >=6.5, neutral 4.5 to 5.5.
Within each category, a one-to-one linear assignment minimizes the SUM OF SQUARED
EUCLIDEAN distances in (valence_z, arousal_z), giving the two dimensions equal weight.
Each English word is used once. These are optimal assignments WITHIN THIS MANUALLY
REVIEWED POOL and these constraints, not a claim of a global optimum over all English nouns.
match_distance_z = sqrt(delta_valence_z^2 + delta_arousal_z^2).
Lower distance means closer numerical matching. There is no validated equivalence cutoff.
Pairings are numerical reference matches, not translations or semantic equivalents.
Z-scoring matches relative database positions; it does not establish cross-language
measurement equivalence, equal subjective emotion, or exact physiological arousal.
Changing the reference vocabularies (e.g. nouns only) would change the z-scores.

Practice words
The original paper does not identify its practice words. Three copies of the ten German
EXPERIMENTAL neutral words were used as reference targets to select 30 distinct English
practice words from remaining eligible candidates. This is an explicit proxy distribution,
not a reconstruction of the original practice list. This file is a WORD POOL, not a trial
sequence; repeated words must be introduced to create the desired n-back targets.

Important source discrepancy
The supplied BAWL-R ratings for the Table 1 words yield mean arousal 4.05008170 (negative),
2.57766512 (positive), and 2.77495915 (neutral), on the 1-5 scale. These do NOT support
matching positive and negative arousal, despite the paper's description of selected sets.
This analysis follows the ACTUAL per-word source ratings, not the paper's rounded prose
values or the study participants' later Table 2 ratings. It cannot establish why the
paper's description differs. If your intended manipulation requires equal positive and
negative arousal, a different stimulus selection is needed; do not describe these sets as
arousal-matched to each other.
The file also lists FREUND as one syllable and AKZENT/INHALT as six phonemes, so the
original Table 1 set does not uniformly meet the paper's stated 6-letter/5-phoneme/2-syllable
criteria according to this supplied BAWL-R file. English constraints are held fixed here.

Limitations
Exact z matching is generally unavailable with finite word pools and simultaneous length
constraints. Largest main-task distance is about 0.99 z-distance units (FRIEDE -> vision).
For example, extremely positive, very low-arousal nouns can be difficult to match while
requiring exactly six letters, five phonemes and two syllables. Group means alone do not
establish distributional equivalence; individual distances and group SDs are supplied.
Review the words/transcriptions and pilot independent word ratings before claiming
emotional equivalence. This is a proposed stimulus set, not a validated equivalent list.

Reproduction
Install pandas, numpy, scipy and openpyxl in your own analysis environment. Put the
unmodified source files into an upload/ directory next to reproduce_matching.py, then run
python reproduce_matching.py. It writes the matching audit CSVs to results/.
