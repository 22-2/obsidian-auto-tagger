# Test Data Setup Guide

## Overview
This guide provides instructions for setting up test data for Auto Tagger integration testing.

## Directory Structure

Create the following directory structure in your test vault:

```
test-notes/
├── batch1/
│   ├── note1.md
│   ├── note2.md
│   ├── note3.md
│   ├── note4.md
│   └── note5.md
├── batch2/
│   ├── note6.md
│   ├── note7.md
│   └── note8.md
├── excluded/
│   └── processed-note.md
└── edge-cases/
    ├── empty-note.md
    ├── note-with-tags.md
    └── long-note.md
```

## Test Note Content

### Batch 1 Notes (test-notes/batch1/)

#### note1.md
```markdown
# Project Management Best Practices

This note discusses various project management methodologies including Agile, Scrum, and Kanban.

Key points:
- Sprint planning is essential
- Daily standups improve communication
- Retrospectives drive continuous improvement

The Agile methodology emphasizes iterative development and customer collaboration.
```

#### note2.md
```markdown
# Machine Learning Fundamentals

An introduction to machine learning concepts and algorithms.

Topics covered:
- Supervised learning
- Unsupervised learning
- Neural networks
- Deep learning architectures

Machine learning is transforming how we solve complex problems in AI.
```

#### note3.md
```markdown
# Productivity Tips for Developers

How to maximize your productivity as a software developer.

Tips:
- Use the Pomodoro technique
- Minimize context switching
- Automate repetitive tasks
- Take regular breaks

Time management is crucial for maintaining high productivity levels.
```

#### note4.md
```markdown
# Introduction to React

React is a popular JavaScript library for building user interfaces.

Core concepts:
- Components
- Props and State
- Hooks
- Virtual DOM

React makes it easy to create interactive UIs with reusable components.
```

#### note5.md
```markdown
# Data Science Workflow

The typical workflow for a data science project.

Steps:
1. Data collection
2. Data cleaning
3. Exploratory analysis
4. Model building
5. Model evaluation
6. Deployment

Data science combines statistics, programming, and domain knowledge.
```

### Batch 2 Notes (test-notes/batch2/)

#### note6.md
```markdown
# Python Programming Basics

An introduction to Python programming language.

Topics:
- Variables and data types
- Control structures
- Functions
- Object-oriented programming

Python is known for its simplicity and readability.
```

#### note7.md
```markdown
# Cloud Computing Overview

Understanding cloud computing services and architectures.

Key concepts:
- IaaS, PaaS, SaaS
- Scalability
- High availability
- Cost optimization

Cloud computing enables on-demand access to computing resources.
```

#### note8.md
```markdown
# UX Design Principles

Fundamental principles of user experience design.

Principles:
- User-centered design
- Consistency
- Feedback
- Accessibility

Good UX design focuses on creating intuitive and enjoyable user experiences.
```

### Excluded Notes (test-notes/excluded/)

#### processed-note.md
```markdown
---
tags:
  - processed
---

# Already Processed Note

This note has already been processed and should be excluded from auto-tagging.

Content about various topics that should not be analyzed.
```

### Edge Case Notes (test-notes/edge-cases/)

#### empty-note.md
```markdown
# Empty Note

This note has minimal content.
```

#### note-with-tags.md
```markdown
---
tags:
  - existing-tag1
  - existing-tag2
---

# Note with Existing Tags

This note already has tags. New tags should be added without removing existing ones.

Content about productivity and project management.
```

#### long-note.md
```markdown
# Very Long Note

This is a very long note to test how the system handles large content.

[Repeat the following paragraph 50 times to create a long note]

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

This note discusses project management, software development, productivity, and various technical topics.
```

## Existing Vault Tags

To test tag suggestions properly, ensure your vault has the following existing tags:

```
#project-management
#agile
#scrum
#productivity
#machine-learning
#ai
#deep-learning
#programming
#javascript
#react
#python
#data-science
#statistics
#cloud-computing
#aws
#ux-design
#user-experience
#software-development
#web-development
#automation
#testing
#meta
#system
#processed
```

You can create these tags by adding them to a dummy note:

```markdown
---
tags:
  - project-management
  - agile
  - scrum
  - productivity
  - machine-learning
  - ai
  - deep-learning
  - programming
  - javascript
  - react
  - python
  - data-science
  - statistics
  - cloud-computing
  - aws
  - ux-design
  - user-experience
  - software-development
  - web-development
  - automation
  - testing
  - meta
  - system
  - processed
---

# Tag Reference Note

This note exists to populate the vault with tags for testing.
```

## Quick Setup Script

If you want to quickly create all test files, you can use the following approach:

1. Create the directory structure manually
2. Copy and paste the content for each note
3. Create the tag reference note
4. Verify all files are created correctly

## Test Configuration

Use the following Auto Tagger settings for testing:

```
Target Directory: test-notes/batch1
Exclude Note Tag: processed
Exclude Suggestion Tags: meta, system
System Instruction: あなたは知識管理の専門家です。ノートの内容を分析し、最も適切なタグを提案してください。
Batch Size: 5 (default)
Log File Path: .obsidian/plugins/personal-context/logs/auto-tag.log
Max Log File Size: 10 MB (default)
```

## Verification Checklist

After setup, verify:
- [ ] All 8 main test notes are created
- [ ] Excluded note has "processed" tag
- [ ] Edge case notes are created
- [ ] Vault has at least 20 existing tags
- [ ] Directory structure matches the plan
- [ ] All notes have valid markdown content

## Cleanup

After testing, you can:
1. Delete the `test-notes/` directory
2. Remove the tag reference note
3. Clear the log file
4. Reset Auto Tagger settings to defaults
