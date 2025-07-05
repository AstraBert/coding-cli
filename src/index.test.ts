import { expect } from '@jest/globals'
import { readFile, writeFile } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { z } from 'zod'

const CODE_SCHEMA = z.object({
  code_content: z.string(),
})

const JUDGING_SCHEMA = z.object({
  pass: z.boolean(),
  feedback: z.string(),
})

const ERROR_SCHEMA = z.object({
  error_explanation: z.string(),
  proposed_fix: z.string(),
})

const FIX_SCHEMA = z.object({
  fixed_content: z.string(),
})

async function readTextFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf8')
  return content
}

async function writeTextFile(filePath: string, content: string): Promise<string> {
  try {
    const parts = filePath.split('.')
    const extension = parts.pop() || ''
    const flName = parts.join('.')
    const flPath = `${flName}_test.${extension}`
    await writeFile(flPath, content, 'utf-8')
    return `Successfully edited your file! Find the edited version at: ${flPath}`
  } catch (error) {
    return `Error creating the edited file: ${error}`
  }
}

describe('readTextFile Test Case', () => {
  it('read README', async () => {
    const content = await readTextFile('README.md')
    expect(typeof content == 'string').toBeTruthy()
  })
})

describe('writeTextFile Test Case', () => {
  it('write sample_test.txt', async () => {
    const content = await writeTextFile('sample.txt', 'This is a sample.')
    expect(content == 'Successfully edited your file! Find the edited version at: sample_test.txt').toBeTruthy()
    expect(existsSync('sample_test.txt')).toBeTruthy()
    expect((await readTextFile('sample_test.txt')) == 'This is a sample.')
    unlinkSync('sample_test.txt')
  })
})

describe('Zod Schemas Test Case', () => {
  it('test zod schemas', () => {
    const codeJson = '{"code_content": "function add(a, b) { return a + b; }"}'
    const judgingJson = '{"pass": true, "feedback": "The function returns the correct result for all test cases."}'
    const errorJson =
      '{"error_explanation": "The function fails when one of the inputs is undefined.", "proposed_fix": "Add input validation to check for undefined values."}'
    const fixJson =
      '{"fixed_content": "function add(a, b) { if (a === undefined || b === undefined) return 0; return a + b; }"}'

    const codeSchema = CODE_SCHEMA.parse(JSON.parse(codeJson))
    const judgingSchema = JUDGING_SCHEMA.parse(JSON.parse(judgingJson))
    const errorSchema = ERROR_SCHEMA.parse(JSON.parse(errorJson))
    const fixSchema = FIX_SCHEMA.parse(JSON.parse(fixJson))

    expect(codeSchema).toEqual({
      code_content: 'function add(a, b) { return a + b; }',
    })
    expect(judgingSchema).toEqual({
      pass: true,
      feedback: 'The function returns the correct result for all test cases.',
    })
    expect(errorSchema).toEqual({
      error_explanation: 'The function fails when one of the inputs is undefined.',
      proposed_fix: 'Add input validation to check for undefined values.',
    })
    expect(fixSchema).toEqual({
      fixed_content: 'function add(a, b) { if (a === undefined || b === undefined) return 0; return a + b; }',
    })
  })
})
