import { readFile, writeFile } from 'fs/promises'
import { OpenAI } from '@llamaindex/openai'
import { z } from 'zod'
import { createStatefulMiddleware, createWorkflow, workflowEvent } from '@llamaindex/workflow'
import { Argv } from 'yargs'
import { logger } from '../logger'
import { bold, green, red, italic, gray, cyan, magenta, yellow } from 'picocolors'

interface FixArgv {}

export const command = 'fix'
export const describe = 'Fixes errors in a file.'
export const aliases = ['f']

export function builder(yargs: Argv<FixArgv>): Argv {
  return yargs
}

async function readTextFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf8')
  return content
}

async function writeTextFile(filePath: string, content: string): Promise<string> {
  try {
    const parts = filePath.split('.')
    const extension = parts.pop() || ''
    const flName = parts.join('.')
    const flPath = `${flName}_fixed.${extension}`
    await writeFile(flPath, content, 'utf-8')
    return `Successfully fixed your file! Find the fixed version at: ${green(bold(flPath))}`
  } catch (error) {
    return `Error creating the edited file: ${error}`
  }
}

const LLM_JUDGE = new OpenAI({ model: 'gpt-4o' })
const LLM = new OpenAI({ model: 'gpt-4.1' })

const ERROR_SCHEMA = z.object({
  error_explanation: z.string(),
  proposed_fix: z.string(),
})

const FIX_SCHEMA = z.object({
  fixed_content: z.string(),
})

const JUDGING_SCHEMA = z.object({
  pass: z.boolean(),
  feedback: z.string(),
})

const startEvent = workflowEvent<{ filePath: string; error: string; errorDetails: string; codeLanguage: string }>()
const errorEvaluationEvent = workflowEvent<{ error_explanation: string; proposed_fix: string }>()
const generationEvent = workflowEvent<{ generatedContent: string }>()
const judgingEvent = workflowEvent<{ pass: boolean; feedback: string }>()
const writingEvent = workflowEvent<{ content: string }>()
const resultEvent = workflowEvent<{ message: string }>()

// Create our workflow
const { withState, getContext } = createStatefulMiddleware(() => ({
  generatedContent: '',
  filePath: '',
  fileContent: '',
  codeLanguage: '',
  error: '',
  errorDetails: '',
  numIterations: 0,
  maxIterations: 3,
}))
const fixFlow = withState(createWorkflow())

// Define handlers for each step
fixFlow.handle([startEvent], async (event) => {
  // Prompt the LLM to write a joke
  const fileContent = await readTextFile(event.data.filePath)
  const response = await LLM.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert ${event.data.codeLanguage} programmer. Your task is to provide an error explanation and to detail a potential error fixing solution.`,
      },
      {
        role: 'user',
        content: `I am working as a ${event.data.codeLanguage} developer and I would  like to fix ${event.data.filePath} because of this error: ${event.data.error}. These are some error details: ${event.data.errorDetails}. This is the content of the file you should edit for me:\n\n'''\n${fileContent}\n'''\n\n. Please generate the edited code.`,
      },
    ],
    responseFormat: ERROR_SCHEMA,
  })
  // Parse the joke from the response
  const jsonResponse = JSON.parse(response.message.content.toString())
  const schemaResponse = ERROR_SCHEMA.parse(jsonResponse)
  const state = getContext().state
  state.filePath = event.data.filePath
  state.codeLanguage = event.data.codeLanguage
  state.error = event.data.error
  state.errorDetails = event.data.errorDetails
  state.fileContent = fileContent
  return errorEvaluationEvent.with({
    error_explanation: schemaResponse.error_explanation,
    proposed_fix: schemaResponse.proposed_fix,
  })
})
fixFlow.handle([errorEvaluationEvent], async (event) => {
  // Prompt the LLM to write a joke
  const state = getContext().state
  state.numIterations++
  const response = await LLM.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert ${state.codeLanguage} programmer. Your task is to generate high quality code that fixes errors based on the error explanation and on a proposed fix.`,
      },
      {
        role: 'user',
        content: `An error is occurring in ${state.filePath}, that is defined as follows:\n\n'''\n${state.fileContent}\n'''\n\n. The error is ${state.error} and there are some details on it: ${state.errorDetails}. A potential error explanation is: ${event.data.error_explanation}. I am proposing the following fix: ${event.data.proposed_fix}. Could you implement it?`,
      },
    ],
    responseFormat: FIX_SCHEMA,
  })
  const jsonResponse = JSON.parse(response.message.content.toString())
  const schemaResponse = FIX_SCHEMA.parse(jsonResponse)
  state.generatedContent = schemaResponse.fixed_content
  if (state.numIterations > state.maxIterations) {
    return writingEvent.with({ content: schemaResponse.fixed_content })
  }
  return generationEvent.with({ generatedContent: schemaResponse.fixed_content })
})
fixFlow.handle([generationEvent], async (event) => {
  // Prompt the LLM to critique the joke
  const state = getContext().state
  const judgeResponse = await LLM_JUDGE.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert ${state.codeLanguage} programmer. Your task is to judge the quality of a code that should fix this feature: ${state.error} with these error details: ${state.errorDetails}. You should output wether the code passes or not your evaluation, and the feedback on the code.`,
      },
      {
        role: 'user',
        content: event.data.generatedContent,
      },
    ],
    responseFormat: JUDGING_SCHEMA,
  })
  // Parse the joke from the response
  const jsonResponse = JSON.parse(judgeResponse.message.content.toString())
  const schemaResponse = JUDGING_SCHEMA.parse(jsonResponse)
  return judgingEvent.with({ pass: schemaResponse.pass, feedback: schemaResponse.feedback })
})
fixFlow.handle([judgingEvent], async (event) => {
  if (event.data.pass) {
    const state = getContext().state
    return writingEvent.with({ content: state.generatedContent })
  } else {
    const state = getContext().state
    const errorDetails = `Your previous fix:\n\n'''\n${state.generatedContent}\n'''\n\nDid not pass the evaluation, and this is the feedback on it: ${event.data.feedback}`
    return startEvent.with({
      filePath: state.filePath,
      error: state.error,
      errorDetails: errorDetails,
      codeLanguage: state.codeLanguage,
    })
  }
})
fixFlow.handle([writingEvent], async (event) => {
  const state = getContext().state
  const msg = await writeTextFile(state.filePath, event.data.content)
  return resultEvent.with({ message: msg })
})

async function runWorkflow(filePath: string, error: string, errorDetails: string, codeLanguage: string): Promise<void> {
  const { stream, sendEvent } = fixFlow.createContext()
  sendEvent(
    startEvent.with({ filePath: filePath, error: error, errorDetails: errorDetails, codeLanguage: codeLanguage }),
  )
  let iteration = 0
  for await (const event of stream) {
    // console.log(event.data);  optionally log the event data
    if (startEvent.include(event)) {
      iteration++
      logger.log(`Started round ${magenta(bold(iteration))} of editing✍️`)
      logger.log('')
    } else if (errorEvaluationEvent.include(event)) {
      logger.log(`Your error ${green(bold('might be explained'))} as follows:\n${event.data.error_explanation}`)
      logger.log('')
      logger.log(`I am ${cyan(bold('proposing this fix'))}:\n${event.data.proposed_fix}`)
      logger.log('')
    } else if (generationEvent.include(event)) {
      logger.log(yellow(bold('A fix has been generated for your file!🎉')))
      logger.log('')
    } else if (judgingEvent.include(event)) {
      if (event.data.pass) {
        logger.log(`Evaluation: ${green(bold('PASS'))}✅`)
      } else {
        logger.log(`Evaluation: ${red(bold('FAIL'))}❌`)
        logger.log(`Reasons: ${event.data.feedback}`)
      }
      logger.log('')
    } else if (writingEvent.include(event)) {
      logger.log(magenta(italic('Writing your file...')))
      logger.log('')
    } else if (resultEvent.include(event)) {
      logger.log(event.data.message)
      break // Stop when we get the final result
    } else {
      continue
    }
  }
}

export async function handler() {
  const codeLanguage = await logger.prompt(
    "👋 Hey there! I'm your personal code debugger 🐛🔧 What programming language are you working with?",
    { type: 'text' },
  )

  const filePath = await logger.prompt(
    `🎯 Awesome! ${green(bold(codeLanguage))} is fantastic! Which file needs fixing? 📁`,
    { type: 'text' },
  )

  const userError = await logger.prompt('🚨 Perfect! What error are you encountering? ⚠️', { type: 'text' })

  const userErrDet = await logger.prompt(
    `🔍 Before fixing ${magenta(italic(filePath))}, share more details about the error or problematic code 💡`,
    { type: 'text' },
  )

  logger.log(gray('─'.repeat(50)))
  logger.log(bold(cyan("✨ Starting the debugging process... Let's squash those bugs! 🐛💥")))
  logger.log('')

  await runWorkflow(filePath, userError, userErrDet, codeLanguage)
}
