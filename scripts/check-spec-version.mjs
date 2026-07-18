// Extract version from package.json file
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Extract major.minor
const [major, minor] = version.split('.').map(Number);
const mmv = `${major}.${minor}`;

// Now find nlpp-spec-vX.X.md file
const specPath = join(process.cwd(), `nlpp-spec-v${mmv}.md`);
// If not found, raise error and recommend to revert the version
if (!existsSync(specPath)) {
    throw new Error(`nlpp-spec-v${mmv}.md not found; the version bump does not match the spec. Please revert the version bump and try again.`);
}
