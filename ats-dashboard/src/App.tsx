import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';

type ApiResponse = {
  eligibility: boolean | string;
  match_score: number; // 0-100 or 0-1
  matched_skills: string[];
  unmatched_skills: string[];
};

function toBooleanEligibility(value: boolean | string): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = value.toString().trim().toLowerCase();
  return normalized === 'eligible' || normalized === 'true' || normalized === 'yes';
}

function normalizeScore(score: number | undefined | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  // Accept 0-1 or 0-100
  if (score <= 1) return Math.round(score * 100);
  return Math.round(score);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error('Unexpected FileReader result'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<boolean | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [unmatchedSkills, setUnmatchedSkills] = useState<string[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted && accepted.length > 0) {
      setResumeFile(accepted[0]);
      setErrorMessage(null);
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections,
  } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const rejectionMessage = useMemo(() => {
    if (!fileRejections || fileRejections.length === 0) return null;
    const first = fileRejections[0];
    const reason = first.errors?.[0]?.message ?? 'File rejected';
    return reason;
  }, [fileRejections]);

  async function handleSubmit() {
    setErrorMessage(null);
    if (!jobDescription.trim()) {
      setErrorMessage('Please paste the job description.');
      return;
    }
    if (!resumeFile) {
      setErrorMessage('Please upload a PDF resume.');
      return;
    }

    try {
      setIsSubmitting(true);
      const base64 = await fileToBase64(resumeFile);
      const response = await fetch('/api/check_eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, resume: base64 }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      const eligible = toBooleanEligibility(data.eligibility);
      const score = normalizeScore(data.match_score);
      setEligibility(eligible);
      setMatchScore(score);
      setMatchedSkills(Array.isArray(data.matched_skills) ? data.matched_skills : []);
      setUnmatchedSkills(Array.isArray(data.unmatched_skills) ? data.unmatched_skills : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Applicant Tracking System (ATS) Dashboard</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Paste the job description and upload your resume to check eligibility.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Input Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Input</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description
                </label>
                <textarea
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                  placeholder="Paste the job description here..."
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm md:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resume/CV (PDF)</label>
                <div
                  {...getRootProps()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-6 transition-colors ${
                    isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="text-center">
                    <p className="text-sm text-gray-700">
                      {resumeFile ? (
                        <span className="font-medium">Selected file:</span>
                      ) : isDragActive ? (
                        'Drop the PDF here...'
                      ) : (
                        'Drag & drop a PDF here, or click to select'
                      )}
                    </p>
                    {resumeFile && (
                      <p className="text-sm text-gray-600 mt-1 truncate">{resumeFile.name}</p>
                    )}
                    {rejectionMessage && (
                      <p className="text-sm text-red-600 mt-1">{rejectionMessage}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Only PDF files are accepted.</p>
              </div>

              {errorMessage && (
                <div className="text-sm text-red-600">{errorMessage}</div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm md:text-base font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </section>

          {/* Output Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Output</h2>
            <div className="space-y-6">
              {/* Eligibility Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Eligibility Status</h3>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <div
                    className={`h-6 w-6 rounded-full ${
                      eligibility == null ? 'bg-gray-300' : eligibility ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    aria-label={eligibility == null ? 'Unknown' : eligibility ? 'Eligible' : 'Not Eligible'}
                  />
                  <div className="text-xl md:text-2xl font-semibold">
                    {eligibility == null ? '—' : eligibility ? 'Eligible' : 'Not Eligible'}
                  </div>
                </div>
              </div>

              {/* Match Score */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Match Score</h3>
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="text-2xl md:text-3xl font-bold">
                    {matchScore == null ? '—' : `${matchScore}%`}
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Matched Skills</h3>
                  <div className="min-h-14 p-3 rounded-lg border border-green-200 bg-green-50">
                    {matchedSkills.length === 0 ? (
                      <p className="text-sm text-gray-500">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {matchedSkills.map((skill, idx) => (
                          <span key={`${skill}-${idx}`} className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Unmatched Skills</h3>
                  <div className="min-h-14 p-3 rounded-lg border border-red-200 bg-red-50">
                    {unmatchedSkills.length === 0 ? (
                      <p className="text-sm text-gray-500">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {unmatchedSkills.map((skill, idx) => (
                          <span key={`${skill}-${idx}`} className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
