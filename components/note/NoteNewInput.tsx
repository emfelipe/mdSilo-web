import type { ForwardedRef } from 'react';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import type { TablerIcon } from '@tabler/icons';
import { IconFilePlus, IconSearch } from '@tabler/icons';
import useNoteSearch from 'editor/hooks/useNoteSearch';
import { getOrNewFileHandle } from 'editor/hooks/useFSA';
import { ciStringEqual, regDateStr } from 'utils/helper';
import { store } from 'lib/store';
import { defaultNote } from 'types/model';

enum OptionType {
  NOTE,
  NEW_NOTE,
}

type Option = {
  id: string;
  type: OptionType;
  text: string;
  icon?: TablerIcon;
};

type Props = {
  onOptionClick?: () => void;
  className?: string;
};

function FindOrCreateInput(props: Props, ref: ForwardedRef<HTMLInputElement>) {
  const { onOptionClick: onOptionClickCallback, className = '' } = props;
  const router = useRouter();

  const [inputText, setInputText] = useState('');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

  const inputTxt = inputText.trim();
  const search = useNoteSearch({ numOfResults: 10 });
  const searchResults = useMemo(() => search(inputTxt), [search, inputTxt]);

  const options = useMemo(() => {
    const result: Array<Option> = [];
    // Show new note option if there isn't already a note called `inputTxt`
    // (We assume if there is a note, then it will be the first result)
    if (
      inputTxt &&
      (searchResults.length <= 0 ||
        !ciStringEqual(inputTxt, searchResults[0].item.title))
    ) {
      result.push({
        id: 'NEW_NOTE',
        type: OptionType.NEW_NOTE,
        text: `New: ${inputTxt}`,
        icon: IconFilePlus,
      });
    }
    // Show notes that match `inputTxt`
    result.push(
      ...searchResults.map((result) => ({
        id: result.item.id,
        type: OptionType.NOTE,
        text: result.item.title,
      }))
    );
    return result;
  }, [searchResults, inputTxt]);

  const onOptionClick = useCallback(
    async (option: Option) => {
      onOptionClickCallback?.();

      if (option.type === OptionType.NEW_NOTE) {
        const noteId = uuidv4();
        const note = { 
          ...defaultNote, 
          id: noteId, 
          title: inputTxt,
          is_daily: regDateStr.test(inputTxt),
        };
        store.getState().upsertNote(note);
        // new FileHandle for the new create note and set in store
        await getOrNewFileHandle(note.title);
        // navigate to md view
        router.push(`/app/md/${note.id}`);
      } else if (option.type === OptionType.NOTE) {
        router.push(`/app/md/${option.id}`);
      } else {
        throw new Error(`Type ${option.type} is not supported`);
      }
    },
    [router, inputTxt, onOptionClickCallback]
  );

  const onKeyDown = useCallback(
    (event) => {
      // Update the selected option based on arrow key input
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedOptionIndex((index) => {
          return index <= 0 ? options.length - 1 : index - 1;
        });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedOptionIndex((index) => {
          return index >= options.length - 1 ? 0 : index + 1;
        });
      }
    },
    [options.length]
  );

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center flex-shrink-0 w-full">
        <IconSearch className="ml-4 text-gray-500" size={20} />
        <input
          ref={ref}
          type="text"
          className={`w-full py-4 px-2 text-xl border-none rounded-tl rounded-tr focus:ring-0 dark:bg-gray-800 dark:text-gray-200 ${
            options.length <= 0 ? 'rounded-bl rounded-br' : ''
          }`}
          placeholder="new or find"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={onKeyDown}
          onKeyPress={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onOptionClick(options[selectedOptionIndex]);
            }
          }}
          autoFocus
        />
      </div>
      {options.length > 0 ? (
        <div className="flex-1 w-full overflow-y-auto bg-white border-t rounded-bl rounded-br dark:bg-gray-800 dark:border-gray-700">
          {options.map((option, index) => (
            <OptionItem
              key={option.id}
              option={option}
              isSelected={index === selectedOptionIndex}
              onClick={() => onOptionClick(option)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type OptionProps = {
  option: Option;
  isSelected: boolean;
  onClick: () => void;
};

const OptionItem = (props: OptionProps) => {
  const { option, isSelected, onClick } = props;

  return (
    <button
      className={`flex flex-row w-full items-center px-4 py-2 text-gray-800 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600 ${
        isSelected ? 'bg-gray-100 dark:bg-gray-900' : ''}`}
      onClick={onClick}
    >
      {option.icon ? (
        <option.icon size={18} className="flex-shrink-0 mr-1" />
      ) : null}
      <span className="overflow-hidden overflow-ellipsis whitespace-nowrap">
        {option.text}
      </span>
    </button>
  );
};

export default forwardRef(FindOrCreateInput);
