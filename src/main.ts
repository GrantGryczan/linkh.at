const MIN_LOCATION_COUNT = 2;
const DEFAULT_WEIGHT = 1;

const outputUrlInput = document.getElementById(
  "output-url",
) as HTMLTextAreaElement;
const outputCopyButton = document.getElementById(
  "output-copy-button",
) as HTMLButtonElement;
const outputCopyStatus = document.getElementById(
  "output-copy-status",
) as HTMLDivElement;
const locationsForm = document.getElementById(
  "locations-form",
) as HTMLFormElement;
const locationsSection = document.getElementById(
  "locations",
) as HTMLTableSectionElement;
const firstLocationRow = document.getElementsByClassName(
  "location",
)[0] as HTMLTableRowElement;

const templateLocationRow = firstLocationRow.cloneNode(
  true,
) as HTMLTableRowElement;

function createLocationRow(): HTMLTableRowElement {
  return templateLocationRow.cloneNode(true) as HTMLTableRowElement;
}

function updateLocationUrlInputs(): void {
  const seenUrls = new Set<string>();

  // Note: All URL inputs must be updated if any one is updated so ex-duplicates
  // can be set as valid.
  for (const urlInput of urlInputs) {
    // Don't let a previous custom validity affect `checkValidity`.
    urlInput.setCustomValidity("");

    if (!urlInput.checkValidity()) {
      continue;
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(urlInput.value).href;
    } catch {
      urlInput.setCustomValidity("Please enter a valid URL.");
      continue;
    }

    if (!normalizedUrl.startsWith("https://")) {
      urlInput.setCustomValidity(
        "Please enter a URL starting with 'https://'.",
      );
      continue;
    }

    if (seenUrls.has(normalizedUrl)) {
      urlInput.setCustomValidity(
        "Please enter a unique URL, not a duplicate of a previous one.",
      );
      continue;
    }

    seenUrls.add(normalizedUrl);
  }
}

function updateLocationRemoveButtons(): void {
  for (let i = 0; i < removeButtons.length; i++) {
    const removeButton = removeButtons[i];

    if (urlInputs.length > MIN_LOCATION_COUNT) {
      removeButton.disabled = false;
      continue;
    }

    const urlInput = urlInputs[i];
    const weightInput = weightInputs[i];

    const isAlreadyReset =
      urlInput.value === urlInput.defaultValue &&
      weightInput.value === weightInput.defaultValue;
    removeButton.disabled = isAlreadyReset;
  }
}

function updateOutput(): void {
  if (!locationsForm.checkValidity()) {
    outputUrlInput.value = "";
    outputCopyButton.disabled = true;
    return;
  }

  let outputUrl = "https://linkh.at/redirect?";

  for (let i = 0; i < urlInputs.length; i++) {
    const urlInput = urlInputs[i];
    const weightInput = weightInputs[i];

    if (i !== 0) {
      outputUrl += "&";
    }

    const normalizedUrl = new URL(urlInput.value).href;
    const compressedUrl = normalizedUrl.slice("https://".length);

    // Leaving slashes decoded saves characters towards the URL size limit and
    // improves readability.
    outputUrl += encodeURIComponent(compressedUrl).replaceAll("%2F", "/");

    if (weightInput.valueAsNumber === DEFAULT_WEIGHT) {
      continue;
    }

    // String values like `2e1` must be converted to number values like `20`.
    outputUrl += "=" + weightInput.valueAsNumber;
  }

  outputUrlInput.value = outputUrl;
  outputCopyButton.disabled = false;
}

function insertLocationRow(): void {
  const newRow = createLocationRow();

  const focusedRow = locationsSection.querySelector(".location:has(:focus)");
  if (focusedRow) {
    focusedRow.after(newRow);
  } else {
    locationsSection.append(newRow);
  }

  updateLocationRemoveButtons();
  updateOutput();

  const newInput = newRow.getElementsByTagName("input")[0];
  newInput.select();
}

function resetLocationRow(row: HTMLTableRowElement): void {
  const [urlInput, weightInput] = row.getElementsByTagName("input");

  urlInput.value = urlInput.defaultValue;
  weightInput.value = weightInput.defaultValue;

  updateLocationUrlInputs();
  updateLocationRemoveButtons();
  updateOutput();

  urlInput.select();
}

function removeLocationRow(row: HTMLTableRowElement): void {
  // TODO: Focus something else first.
  row.remove();

  updateLocationUrlInputs();
  updateLocationRemoveButtons();
  updateOutput();
}

function handleRemoveButtonClick(removeButton: HTMLButtonElement): void {
  const row = removeButton.closest(".location") as HTMLTableRowElement;

  if (urlInputs.length === MIN_LOCATION_COUNT) {
    resetLocationRow(row);
  } else {
    removeLocationRow(row);
  }
}

locationsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  insertLocationRow();
});

locationsSection.addEventListener("click", (event) => {
  const target = event.target as Element;

  const removeButton = target.closest(
    ".location-remove-button",
  ) as HTMLButtonElement;
  if (removeButton) {
    handleRemoveButtonClick(removeButton);
  }
});

locationsSection.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.name === "url") {
    updateLocationUrlInputs();
  }

  updateLocationRemoveButtons();
  updateOutput();
});

function hideCopyStatus(): void {
  outputCopyStatus.hidden = true;
  outputCopyStatus.textContent = "";
}

function showCopyStatus(text: string): void {
  if (document.activeElement !== outputCopyButton) {
    return;
  }

  outputCopyStatus.hidden = false;
  outputCopyStatus.textContent = text;
}

outputCopyButton.addEventListener("blur", hideCopyStatus);

outputCopyButton.addEventListener("click", async () => {
  // ARIA live regions only announce changes, so hide the status first in case
  // the content will be the same.
  hideCopyStatus();

  try {
    await navigator.clipboard.writeText(outputUrlInput.value);
  } catch {
    showCopyStatus("Failed to copy");
    return;
  }

  showCopyStatus("Copied");
});

// At least 2 locations are required, so add a second initial row.
locationsSection.append(createLocationRow());

// These only return form element lists after appending the second row.
const urlInputs = locationsForm.elements.namedItem("url") as RadioNodeList;
const weightInputs = locationsForm.elements.namedItem(
  "weight",
) as RadioNodeList;
const removeButtons = locationsForm.elements.namedItem(
  "remove",
) as unknown as NodeListOf<HTMLButtonElement>;
