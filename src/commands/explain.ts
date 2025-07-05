import { z } from 'zod'
import { MessageContent } from 'llamaindex'
import { OpenAI } from '@llamaindex/openai'
import { readFile } from 'fs/promises'
import { Argv } from 'yargs'
import { logger } from '../logger'
import { bold, green, red, italic, blue, gray, white, cyan, magenta, yellow } from 'picocolors'

interface ExplainArgv {}

export const command = 'explain'
export const describe = 'Explains the code content of a file.'
export const aliases = ['x']

export function builder(yargs: Argv<ExplainArgv>): Argv {
  return yargs
}

const LLM = new OpenAI({
  model: 'gpt-4o',
})

const SCHEMA = z.object({
  code_overview: z.string(),
  focal_points: z.array(z.string()),
  core_concepts_to_learn: z.array(z.string()),
  extra_information: z.string(),
})

type AnalysisResult = z.infer<typeof SCHEMA>

function renderAnalysis(analysis: AnalysisResult) {
  // Header
  logger.log(bold(blue('📋 Code Analysis Report')))
  logger.log('')

  // Code Overview
  logger.log(bold(green('🔍 Code Overview')))
  logger.log(gray('─'.repeat(50)))
  logger.log(white(analysis.code_overview))
  logger.log('')

  // Focal Points
  logger.log(bold(yellow('🎯 Focal Points')))
  logger.log(gray('─'.repeat(50)))
  analysis.focal_points.forEach((point, index) => {
    logger.log(cyan(`${index + 1}. `) + white(point))
  })
  logger.log('')

  // Core Concepts
  logger.log(bold(magenta('📚 Core Concepts to Learn')))
  logger.log(gray('─'.repeat(50)))
  analysis.core_concepts_to_learn.forEach((concept, _) => {
    logger.log(magenta(`• `) + white(concept))
  })
  logger.log('')

  // Extra Information
  logger.log(bold(red('💡 Extra Information')))
  logger.log(gray('─'.repeat(50)))
  logger.log(white(analysis.extra_information))
}

// Function to safely parse and render MessageContent
function parseAndRenderAnalysis(messageContent: MessageContent) {
  try {
    // Parse the MessageContent to JSON
    const jsonData = JSON.parse(messageContent.toString())

    // Validate against schema
    const validatedData = SCHEMA.parse(jsonData)

    // Render the validated data
    renderAnalysis(validatedData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(red('❌ Schema validation failed:'))
      error.errors.forEach((err) => {
        logger.error(red(`  - ${err.path.join('.')}: ${err.message}`))
      })
    } else {
      logger.error(red('❌ Failed to parse message content:'), error)
    }
  }
}

async function readTextFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf8')
  return content
}

async function explainCode(
  codeLanguage: string,
  filePath: string,
  level: string,
  problem: string,
): Promise<MessageContent> {
  //response format as zod schema
  const fileContent = await readTextFile(filePath)
  const response = await LLM.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert ${codeLanguage} programmer. Your task is to explain the code in a file by producing a code overview, highlighting the focal points of the code, proposing core concepts to learn in order to understand the code and adding also any extra information containing tips and trick related to the code you explained. Remember to always adapt your explanations to the level of the person who is asking you to explain the code, and to also address their problems with the code itself in the various part of the explanation.`,
      },
      {
        role: 'user',
        content: `I am at a ${level} level in ${codeLanguage} and I am struggling to understant this file: ${filePath} because I have the following problem: ${problem}. This is the content of the file you should explain to me:\n\n'''\n${fileContent}\n'''\n\n. Please explain it to me.`,
      },
    ],
    responseFormat: SCHEMA,
  })
  return response.message.content
}

export async function handler() {
  const codeLanguage = await logger.prompt(
    'Hey there! I am your personal assistant specialized in explaining code files. Before we start, let me ask you a couple of questions: what programming language are you working with?',
    {
      type: 'text',
    },
  )

  const userLevel = await logger.prompt(
    `Ok, I see: ${green(bold(codeLanguage))} is a great language! And what is your level?`,
    {
      type: 'select',
      options: ['absolute beginner', 'beginner', 'intermediate', 'upper-intermediate', 'advanced', 'absolute mastery'],
    },
  )

  const filePath = await logger.prompt('Ok, great! What file do you need to be explained?', {
    type: 'text',
  })

  const userProblem = await logger.prompt(
    `Perfect, but before diving deeper into explaining ${magenta(italic(filePath))}, can you tell me what seems to be the problem with it?`,
    {
      type: 'text',
    },
  )

  logger.log(gray('─'.repeat(50)))
  logger.log(bold(cyan('Hang on, I will provide you with the explanation soon...')))
  logger.log('')

  const codeExplanation = await explainCode(codeLanguage, filePath, userLevel, userProblem)

  parseAndRenderAnalysis(codeExplanation)
}
