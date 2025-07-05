// edit the code of a file
import { writeFile, readFile } from 'fs/promises'
import { z } from 'zod'
import { createStatefulMiddleware, createWorkflow, workflowEvent } from '@llamaindex/workflow'
import { OpenAI } from '@llamaindex/openai'
import { Argv } from 'yargs'
import { logger } from '../logger'
import { bold, green, red, italic, gray, cyan, magenta, yellow } from 'picocolors'

interface EditArgv {}

export const command = 'edit'
export const describe = 'Edits the content of a file.'
export const aliases = ['e']

export function builder(yargs: Argv<EditArgv>): Argv {
  return yargs
}

const CODE_SCHEMA = z.object({
  code_content: z.string(),
})

const JUDGING_SCHEMA = z.object({
  pass: z.boolean(),
  feedback: z.string(),
})

const LLM_JUDGE = new OpenAI({ model: 'gpt-4.1-mini' })
const LLM = new OpenAI({ model: 'gpt-4.1' })

const startEvent = workflowEvent<{
  filePath: string
  feature: string
  implementationDetails: string
  codeLanguage: string
}>()
const generationEvent = workflowEvent<{ generatedContent: string }>()
const judgingEvent = workflowEvent<{ pass: boolean; feedback: string }>()
const writingEvent = workflowEvent<{ content: string }>()
const resultEvent = workflowEvent<{ message: string }>()

// Create our workflow
const { withState, getContext } = createStatefulMiddleware(() => ({
  generatedContent: '',
  filePath: '',
  codeLanguage: '',
  feature: '',
  implementationDetails: '',
  numIterations: 0,
  maxIterations: 3,
}))
const editFlow = withState(createWorkflow())

async function readTextFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf8')
  return content
}

async function writeTextFile(filePath: string, content: string): Promise<string> {
  try {
    const parts = filePath.split('.')
    const extension = parts.pop() || ''
    const flName = parts.join('.')
    const flPath = `${flName}_edited.${extension}`
    await writeFile(flPath, content, 'utf-8')
    return `Successfully edited your file! Find the edited version at: ${green(bold(flPath))}`
  } catch (error) {
    return `Error creating the edited file: ${error}`
  }
}

// Define handlers for each step
editFlow.handle([startEvent], async (event) => {
  // Prompt the LLM to write a joke
  const fileContent = await readTextFile(event.data.filePath)
  const response = await LLM.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert ${event.data.codeLanguage} programmer. Your task is to generate high-quality code following the feature request and implementation details that are provided to you by the user. Please output only the code.`,
      },
      {
        role: 'user',
        content: `I am working as a ${event.data.codeLanguage} developer and I would like to edit ${event.data.filePath} with this feature: ${event.data.feature}; following these implementation details: ${event.data.implementationDetails}. This is the content of the file you should edit for me:\n\n'''\n${fileContent}\n'''\n\n. Please generate the edited code.`,
      },
    ],
    responseFormat: CODE_SCHEMA,
  })
  // Parse the joke from the response
  const jsonResponse = JSON.parse(response.message.content.toString())
  const schemaResponse = CODE_SCHEMA.parse(jsonResponse)
  const state = getContext().state
  state.numIterations++
  state.filePath = event.data.filePath
  state.codeLanguage = event.data.codeLanguage
  state.generatedContent = schemaResponse.code_content
  state.feature = event.data.feature
  state.implementationDetails = event.data.implementationDetails
  if (state.numIterations > state.maxIterations) {
    return writingEvent.with({ content: schemaResponse.code_content })
  }
  return generationEvent.with({ generatedContent: schemaResponse.code_content })
})
editFlow.handle([generationEvent], async (event) => {
  // Prompt the LLM to critique the joke
  const state = getContext().state
  const judgeResponse = await LLM_JUDGE.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert ${state.codeLanguage} programmer. Your task is to judge the quality of a code that should implement this feature: ${state.feature} with these implementation details: ${state.implementationDetails}. You should output wether the code passes or not your evaluation, and the feedback on the code.`,
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
editFlow.handle([judgingEvent], async (event) => {
  if (event.data.pass) {
    const state = getContext().state
    return writingEvent.with({ content: state.generatedContent })
  } else {
    const state = getContext().state
    const implementationDetails = `Your previous implementation:\n\n'''\n${state.generatedContent}\n'''\n\nDid not pass the evaluation, and this is the feedback on it: ${event.data.feedback}`
    return startEvent.with({
      filePath: state.filePath,
      feature: state.feature,
      implementationDetails: implementationDetails,
      codeLanguage: state.codeLanguage,
    })
  }
})
editFlow.handle([writingEvent], async (event) => {
  const state = getContext().state
  const msg = await writeTextFile(state.filePath, event.data.content)
  return resultEvent.with({ message: msg })
})

async function runWorkflow(
  filePath: string,
  feature: string,
  implementationDetails: string,
  codeLanguage: string,
): Promise<void> {
  const { stream, sendEvent } = editFlow.createContext()
  sendEvent(
    startEvent.with({
      filePath: filePath,
      feature: feature,
      implementationDetails: implementationDetails,
      codeLanguage: codeLanguage,
    }),
  )
  let iteration = 0
  for await (const event of stream) {
    // console.log(event.data);  optionally log the event data
    if (startEvent.include(event)) {
      iteration++
      logger.log(`Started round ${green(bold(iteration))} of editing✍️`)
      logger.log('')
    } else if (generationEvent.include(event)) {
      logger.log(yellow(bold('File has been edited!🎉')))
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
    "👋 Hey there! I'm your personal code editor 🛠️✨ What programming language are you working with?",
    { type: 'text' },
  )

  const filePath = await logger.prompt(
    `🎯 Awesome! ${green(bold(codeLanguage))} is fantastic! Which file would you like to edit? 📝`,
    { type: 'text' },
  )

  const userFeature = await logger.prompt('🚀 Perfect! What change would you like to make? ⚡', { type: 'text' })

  const userImpDet = await logger.prompt(
    `🔧 Before editing ${magenta(italic(filePath))}, share your implementation details 💡`,
    { type: 'text' },
  )

  logger.log(gray('─'.repeat(50)))
  logger.log(bold(cyan('✨ Starting the editing process... Almost ready! 🎨')))
  logger.log('')

  await runWorkflow(filePath, userFeature, userImpDet, codeLanguage)
}
