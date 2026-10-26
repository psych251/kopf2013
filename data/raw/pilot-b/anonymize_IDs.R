library(readr)

data_dir <- "/Users/bsevchik/Documents/classes/PSYCH 251 (Experimental Methods)/un-anonymized_data/pilot-b"

trials_path <- file.path(data_dir, "trials.csv")
key_path <- file.path(data_dir, "participants_with_key.csv")
backup_path <- file.path(data_dir, "trials-no-anonymous.csv")

# Stop rather than overwrite an existing backup.
if (!file.exists(trials_path) || !file.exists(key_path)) {
  stop("Could not find trials.csv or participants_with_key.csv.")
}
if (file.exists(backup_path)) {
  stop("trials-no-anonymous.csv already exists. No files were changed.")
}

# Read everything as text to preserve IDs and other column values.
# Preserve whitespace because a space can represent a space-bar response.
read_text_csv <- function(path) {
  read_csv(
    path,
    col_types = cols(.default = col_character()),
    trim_ws = FALSE,
    na = character(),
    show_col_types = FALSE
  )
}

trials <- read_text_csv(trials_path)
keys <- read_text_csv(key_path)

if (!"participant_id" %in% names(trials) ||
    !all(c("participant_id", "participant_id_key") %in% names(keys))) {
  stop("Required columns are missing. No files were changed.")
}

if (anyNA(keys$participant_id) ||
    any(keys$participant_id == "") ||
    anyDuplicated(keys$participant_id) > 0) {
  stop("The key file has missing or duplicated original IDs. No files were changed.")
}

if (anyNA(keys$participant_id_key) ||
    any(keys$participant_id_key == "") ||
    anyDuplicated(keys$participant_id_key) > 0) {
  stop("Replacement IDs must be present and unique. No files were changed.")
}

# Match by original ID, not by row position between the two files.
matched_rows <- match(trials$participant_id, keys$participant_id)

if (anyNA(matched_rows)) {
  stop("Some trial participant IDs have no matching key. No files were changed.")
}

trials$participant_id <- keys$participant_id_key[matched_rows]

# Write the replacement successfully before renaming the original.
temp_path <- tempfile(pattern = "trials-updated-", tmpdir = data_dir,
                      fileext = ".csv")
write_csv(trials, temp_path, na = "")

if (!file.rename(trials_path, backup_path)) {
  unlink(temp_path)
  stop("Could not rename the original trials.csv.")
}

if (!file.rename(temp_path, trials_path)) {
  restored <- file.rename(backup_path, trials_path)
  if (restored) {
    unlink(temp_path)
    stop("Could not install the updated CSV. The original was restored.")
  }
  stop("Could not install or restore trials.csv. The original remains at: ",
       backup_path, ". Updated data remain at: ", temp_path)
}

message("Done: trials.csv contains the replacement IDs.")
message("Original file preserved as trials-no-anonymous.csv.")